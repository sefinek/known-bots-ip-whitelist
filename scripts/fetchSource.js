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

const RETRYABLE_ERROR_CODES = new Set([
	'ECONNRESET',
	'ETIMEDOUT',
	'ECONNREFUSED',
	'EAI_AGAIN',
	'ENETUNREACH',
	'EHOSTUNREACH',
	'EPIPE',
]);

const isRetryableError = err => (
	err instanceof NetworkError ||
	err instanceof TimeoutError ||
	(Boolean(err?.code) && RETRYABLE_ERROR_CODES.has(err.code))
);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const executeWithRetry = async (operation, {
	retries = 2,
	delay = 1000,
	backoff = 2,
	label = 'operation',
	retryPredicate = isRetryableError,
} = {}) => {
	let attempt = 0;
	while (attempt <= retries) {
		try {
			return await operation();
		} catch (err) {
			if (!retryPredicate(err) || attempt === retries) throw err;
			const waitMs = delay * Math.pow(backoff, attempt);
			logger.warn(`Retrying ${label} in ${waitMs}ms (attempt ${attempt + 1}/${retries + 1}): ${err.message}`);
			await sleep(waitMs);
			attempt++;
		}
	}
};

const readCustomFiles = async files => {
	const fileList = (Array.isArray(files) ? files : [files]).filter(Boolean);
	if (!fileList.length) throw new Error('Custom file name is required');

	const results = await Promise.all(fileList.map(async file => {
		const filePath = path.join(__dirname, '../custom', file);
		try {
			const data = await fs.readFile(filePath, 'utf8');
			const sourceUrl = `https://github.com/sefinek/known-bots-ip-whitelist/blob/main/custom/${file}`;
			return parseList(splitAndFilter(data), sourceUrl);
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

module.exports = async source => {
	let out = [];

	try {
		validateSource(source);

		switch (source.type) {
		case 'whois':
			if (!source.asn) throw new Error(`Missing ASN for ${source.name}`);
			out = await executeWithRetry(
				() => processWithTimeout(getASNPrefixes(source), 120000),
				{ label: `${source.name} WHOIS` }
			);
			break;

		case 'yandex':
			out = await executeWithRetry(
				() => processWithTimeout(getYandexIPs(), 90000),
				{ label: `${source.name} Yandex` }
			);
			break;

		case 'file': {
			if (!source.file) throw new Error(`Missing file for ${source.name}`);
			out = await readCustomFiles(source.file);
			break;
		}

		case 'hosts': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);
			const res = await executeWithRetry(
				() => processWithTimeout(axios.get(source.url)),
				{ label: `${source.name} hosts` }
			);
			out = parseList(splitAndFilter(res.data), source.url);
			break;
		}

		case 'textMulti': {
			if (!Array.isArray(source.url) || !source.url.length) throw new Error(`Missing URLs array for ${source.name}`);

			const results = await Promise.allSettled(
				source.url.map(async u => {
					try {
						const { data } = await executeWithRetry(
							() => processWithTimeout(axios.get(u)),
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
			out = results
				.filter(r => r.status === 'fulfilled')
				.flatMap(r => r.value);
			break;
		}

		case 'jsonPrefixes': {
			if (!source.url) throw new Error(`Missing URL for ${source.name}`);

			const res = await executeWithRetry(
				() => processWithTimeout(axios.get(source.url)),
				{ label: `${source.name} jsonPrefixes` }
			);
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

			const { data } = await executeWithRetry(
				() => processWithTimeout(axios.get(source.url)),
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
				() => processWithTimeout(axios.get(source.url)),
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
				() => processWithTimeout(axios.get(source.url)),
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

		out = Array.from(new Map(out.map(r => [`${r.ip}|${r.source}`, r])).values());
		if (!out.length) logger.warn(`No valid IPs found for ${source.name}`);

		return out;
	} catch (err) {
		logger.err(`Failed to fetch ${source.name}: ${err.message}`);
		if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') throw new NetworkError(`Network error for ${source.name}: ${err.message}`, err);
		throw err;
	}
};
