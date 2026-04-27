const fs = require('node:fs/promises');
const path = require('node:path');
const getYandexIPs = require('./parser/yandex.js');
const getASNPrefixes = require('./services/whois.js');
const axios = require('./services/axios.js');
const logger = require('./utils/logger.js');
const { NetworkError, TimeoutError } = require('./utils/errors.js');
const { executeWithRetry } = require('./utils/retry.js');
const { validateSource } = require('./utils/validation.js');
const { isValidIP } = require('./ipUtils.js');

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

const parseCustomFileData = (data, source) => {
	if (typeof data !== 'string') return [];
	const lines = data.split(/\r?\n/);
	let currentLabel = null;
	const results = [];

	for (const raw of lines) {
		const line = raw.trim();
		if (!line) continue;

		if (line.startsWith('#')) {
			currentLabel = line.slice(1).trim() || null;
			continue;
		}

		const hashIdx = line.indexOf('#');
		const ipPart = hashIdx !== -1 ? line.slice(0, hashIdx).trim() : line;
		if (!ipPart || !isValidIP(ipPart)) continue;

		const record = { ip: ipPart, source };
		if (currentLabel) record.label = currentLabel;
		results.push(record);
	}

	return results;
};

const mergeRecordsByIp = records => {
	const map = new Map();

	for (const record of records) {
		if (!record?.ip) continue;
		const entry = map.get(record.ip) || { ip: record.ip, sources: new Set(), labels: new Set() };
		const sources = Array.isArray(record.sources)
			? record.sources
			: (record.source ? [record.source] : []);

		for (const src of sources) {
			if (typeof src !== 'string') continue;
			const trimmed = src.trim();
			if (trimmed) entry.sources.add(trimmed);
		}

		if (record.label) entry.labels.add(record.label);
		map.set(record.ip, entry);
	}

	return Array.from(map.values()).map(entry => {
		const result = { ip: entry.ip, sources: Array.from(entry.sources).sort() };
		if (entry.labels.size > 0) result.label = Array.from(entry.labels).join(' | ');
		return result;
	});
};

const readCustomFiles = async files => {
	const fileList = (Array.isArray(files) ? files : [files]).filter(Boolean);
	if (!fileList.length) throw new Error('Custom file name is required');

	const results = await Promise.all(fileList.map(async file => {
		const filePath = path.join(__dirname, '../custom', file);
		try {
			const data = await fs.readFile(filePath, 'utf8');
			return parseCustomFileData(data, `https://github.com/sefinek/known-bots-ip-whitelist/blob/main/custom/${file}`);
		} catch (err) {
			throw new Error(`Failed to read file ${file}: ${err.message}`);
		}
	}));

	return results.flat();
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

const fetchWithTimeout = async (url, config = {}, timeoutMs = 60000) => {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await axios.get(url, { ...config, signal: controller.signal });
	} catch (err) {
		if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
			throw new TimeoutError(`Operation timeout after ${timeoutMs}ms`, timeoutMs);
		}
		throw err;
	} finally {
		clearTimeout(timeoutId);
	}
};

module.exports = async source => {
	let out = [];

	try {
		validateSource(source);

		switch (source.type) {
		case 'whois':
			if (!source.asn) throw new Error(`Missing ASN for ${source.name}`);
			out = await executeWithRetry(() => processWithTimeout(getASNPrefixes(source), 60000), { label: `${source.name} WHOIS` });
			break;

		case 'yandex':
			out = await executeWithRetry(() => processWithTimeout(getYandexIPs(), 60000), { label: `${source.name} Yandex` });
			break;

		case 'file': {
			if (!source.file) throw new Error(`Missing file for ${source.name}`);
			out = await readCustomFiles(source.file);
			break;
		}

		case 'hosts': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);
			const res = await executeWithRetry(
				() => fetchWithTimeout(source.url),
				{ label: `${source.name} hosts` }
			);
			out = parseList(splitAndFilter(res.data), source.url);
			break;
		}

		case 'textMulti': {
			if (!Array.isArray(source.url) || !source.url.length) throw new Error(`Missing URLs array for ${source.name}`);

			const results = await Promise.all(
				source.url.map(async u => {
					try {
						const { data } = await executeWithRetry(
							() => fetchWithTimeout(u),
							{ label: `${source.name} ${u}` }
						);
						if (typeof data === 'string') return parseList(splitAndFilter(data), u);
						if (Array.isArray(data)) return parseList(data.map(String).map(l => l.trim()).filter(Boolean), u);
						return [];
					} catch (err) {
						logger.warn(`Failed to fetch ${u}: ${err.message}`);
						return [];
					}
				})
			);
			out = results.flat();
			break;
		}

		case 'jsonPrefixes': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const urls = Array.isArray(source.url) ? source.url : [source.url];
			const results = await Promise.allSettled(
				urls.map(async u => {
					try {
						const res = await executeWithRetry(
							() => fetchWithTimeout(u),
							{ label: `${source.name} ${u}` }
						);
						const data = res.data;
						if (!data || typeof data !== 'object') throw new Error('Invalid JSON response');
						return parseList(
							(data.prefixes || []).map(p => p.ipv4Prefix || p.ipv6Prefix).filter(Boolean),
							u
						);
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
		case 'jsonIps': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const { data } = await executeWithRetry(
				() => fetchWithTimeout(source.url),
				{ label: `${source.name} jsonIps` }
			);
			if (!data || typeof data !== 'object') throw new Error('Invalid JSON response');

			out = parseList(
				(data.ips || []).map(o => o.ip_address).filter(Boolean),
				source.url
			);

			break;
		}
		case 'jsonAddresses': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const res = await executeWithRetry(
				() => fetchWithTimeout(source.url),
				{ label: `${source.name} jsonAddresses` }
			);
			const data = res.data;
			if (!data || typeof data !== 'object' || !data.data) throw new Error('Invalid JSON response structure');

			out = parseList(Object.values(data.data).flatMap(d => d.addresses || []).filter(Boolean), source.url);

			break;
		}
		case 'mdList': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const { data } = await executeWithRetry(
				() => fetchWithTimeout(source.url),
				{ label: `${source.name} markdown list` }
			);
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

		if (source.extraFiles) {
			try {
				const extraRecords = await readCustomFiles(source.extraFiles);
				out = out.concat(extraRecords);
			} catch (err) {
				logger.warn(`Failed to append extra files for ${source.name}: ${err.message}`);
			}
		}

		out = mergeRecordsByIp(out);
		if (!out.length) logger.warn(`No valid IPs found for ${source.name}`);

		return out;
	} catch (err) {
		logger.err(`Failed to fetch ${source.name}: ${err.message}`);
		if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') throw new NetworkError(`Network error for ${source.name}: ${err.message}`, err);
		throw err;
	}
};
