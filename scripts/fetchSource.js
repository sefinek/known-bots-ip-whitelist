const fs = require('node:fs/promises');
const path = require('node:path');
const ipaddr = require('ipaddr.js');
const getYandexIPs = require('./parser/yandex.js');
const getASNPrefixes = require('./services/whois.js');
const axios = require('./services/axios.js');
const logger = require('./utils/logger.js');
const { NetworkError, TimeoutError } = require('./utils/errors.js');
const { validateSource } = require('./utils/validation.js');

const isValidIP = ip => {
	try {
		if (ip.includes('/')) {
			ipaddr.parseCIDR(ip);
			return true;
		}
		return ipaddr.isValid(ip);
	} catch {
		return false;
	}
};

const splitAndFilter = data => {
	if (typeof data !== 'string') return [];
	return data
		.split(/\r?\n/)
		.map(l => l.trim())
		.filter(l => l && !l.startsWith('#') && isValidIP(l));
};

const parseList = (list, source) => {
	if (!Array.isArray(list)) return [];
	return list
		.filter(ip => ip && typeof ip === 'string' && isValidIP(ip.trim()))
		.map(ip => ({ ip: ip.trim(), source }));
};


const processWithTimeout = async (promise, timeoutMs = 60000) => {
	let timeoutId;
	return Promise.race([
		promise,
		new Promise((_, reject) => {
			timeoutId = setTimeout(() => reject(new TimeoutError(`Operation timeout after ${timeoutMs}ms`, timeoutMs)), timeoutMs);
		}),
	]).finally(() => {
		if (timeoutId) clearTimeout(timeoutId);
	});
};

module.exports = async source => {
	let out = [];

	try {
		validateSource(source);

		switch (source.type) {
		case 'whois':
			if (!source.asn) throw new Error(`Missing ASN for ${source.name}`);
			out = await processWithTimeout(getASNPrefixes(source), 120000);
			break;

		case 'yandex':
			out = await processWithTimeout(getYandexIPs(), 90000);
			break;

		case 'file': {
			if (!source.file) throw new Error(`Missing file for ${source.name}`);
			const filePath = path.join(__dirname, '../custom', source.file);
			try {
				const data = await fs.readFile(filePath, 'utf8');
				const sourceUrl = `https://github.com/sefinek/known-bots-ip-whitelist/blob/main/custom/${source.file}`;
				out = parseList(splitAndFilter(data), sourceUrl);
			} catch (err) {
				throw new Error(`Failed to read file ${source.file}: ${err.message}`);
			}
			break;
		}

		case 'hosts': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);
			const res = await processWithTimeout(axios.get(source.url));
			out = parseList(splitAndFilter(res.data), source.url);
			break;
		}

		case 'textMulti': {
			if (!Array.isArray(source.url) || !source.url.length) throw new Error(`Missing URLs array for ${source.name}`);

			const results = await Promise.allSettled(
				source.url.map(async u => {
					try {
						const { data } = await processWithTimeout(axios.get(u));
						if (typeof data === 'string') return parseList(splitAndFilter(data), u);
						if (Array.isArray(data)) return parseList(data.map(String).map(l => l.trim()).filter(Boolean), u);
						return [];
					} catch (err) {
						logger.warn(`Failed to fetch ${u}: ${err.message}`);
						return [];
					}
				})
			);
			out = results
				.filter(r => r.status === 'fulfilled')
				.flatMap(r => r.value);
			break;
		}

		case 'jsonPrefixes': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const res = await processWithTimeout(axios.get(source.url));
			const data = res.data;
			if (!data || typeof data !== 'object') throw new Error('Invalid JSON response');

			out = parseList(
				(data.prefixes || []).map(p => p.ipv4Prefix || p.ipv6Prefix).filter(Boolean),
				source.url
			);

			break;
		}
		case 'jsonIps': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const { data } = await processWithTimeout(axios.get(source.url));
			if (!data || typeof data !== 'object') throw new Error('Invalid JSON response');

			out = parseList(
				(data.ips || []).map(o => o.ip_address).filter(Boolean),
				source.url
			);

			break;
		}
		case 'jsonAddresses': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const res = await processWithTimeout(axios.get(source.url));
			const data = res.data;
			if (!data || typeof data !== 'object' || !data.data) throw new Error('Invalid JSON response structure');

			out = parseList(Object.values(data.data).flatMap(d => d.addresses || []).filter(Boolean), source.url);

			break;
		}
		case 'mdList': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const { data } = await processWithTimeout(axios.get(source.url));
			if (typeof data !== 'string') throw new Error('Expected text response for markdown');

			out = parseList(
				data
					.split(/\r?\n/)
					.filter(l => l.startsWith('- '))
					.map(l => l.replace(/^- /, '').trim())
					.filter(Boolean),
				source.url
			);

			break;
		}

		default:
			throw new Error(`Unknown source type: ${source.type}`);
		}

		out = Array.from(new Map(out.map(r => [`${r.ip}|${r.source}`, r])).values());
		if (!out.length) logger.warn(`No valid IPs found for ${source.name}`);

		return out;
	} catch (err) {
		logger.err(`Failed to fetch ${source.name}: ${err.message}`);
		if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') throw new NetworkError(`Network error for ${source.name}: ${err.message}`, err);
		throw err;
	}
};