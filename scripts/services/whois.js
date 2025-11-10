const net = require('node:net');
const axios = require('./axios.js');
const { parseIP, compareIPs } = require('../ipUtils.js');

const logger = require('../utils/logger.js');

const WHOIS_HOSTS = ['whois.radb.net', 'whois.arin.net'];
const WHOIS_PORT = 43;

const fetchRoutesFromHost = async (asn, host) => {
	return new Promise(resolve => {
		let buffer = '';
		let hasResolved = false;
		const sock = net.createConnection(WHOIS_PORT, host);
		sock.setEncoding('utf8');
		sock.setTimeout(30000);

		const safeResolve = (data) => {
			if (!hasResolved) {
				hasResolved = true;
				resolve(data);
			}
		};

		const req = host === 'whois.arin.net'
			? `AS${asn.replace(/^AS/i, '')}\r\n`
			: `-i origin AS${asn.replace(/^AS/i, '')}\r\n`;

		sock.on('data', chunk => {
			buffer += chunk;
			if (buffer.length > 10 * 1024 * 1024) {
				logger.warn(`Response too large from ${host}, truncating`);
				sock.destroy();
				safeResolve([]);
				return;
			}
		});

		sock.on('error', err => {
			logger.warn(`WHOIS error for ${host} (ASN ${asn}): ${err.message}`);
			safeResolve([]);
		});

		sock.on('timeout', () => {
			logger.warn(`WHOIS timeout for ${host} (ASN ${asn})`);
			sock.destroy();
			safeResolve([]);
		});

		sock.on('end', () => {
			try {
				const routes = [];
				const lines = buffer.split(/\r?\n/);

				for (const line of lines) {
					if ((/^route6?:/i).test(line)) {
						const ip = line.replace(/^route6?:/i, '').trim();
						if (ip && parseIP(ip)) {
							routes.push({ ip, source: host });
						}
					}
				}
				safeResolve(routes);
			} catch (err) {
				logger.err(`Failed to parse WHOIS response from ${host} (ASN ${asn}): ${err.message}`);
				safeResolve([]);
			}
		});

		try {
			sock.write(req, () => sock.end());
		} catch (err) {
			logger.err(`Failed to write to WHOIS socket ${host} (ASN ${asn}): ${err.message}`);
			safeResolve([]);
		}
	});
};

const makeKeywords = src => {
	const arr = [];
	if (src.analyzeKeywords && Array.isArray(src.keywords) && src.keywords.length) {
		for (const k of src.keywords) arr.push(String(k || '').toLowerCase());
	}
	arr.push(String(src.name || '').toLowerCase());
	arr.push(String(src.dir || '').toLowerCase());
	return Array.from(new Set(arr.filter(Boolean)));
};

const sleep = (baseMs, randomMs = 0) => {
	const finalMs = baseMs + Math.floor(Math.random() * randomMs);
	return new Promise(resolve => setTimeout(resolve, finalMs));
};

const fetchFromBGPView = async (src, shouldDelay = true, retryCount = 0) => {
	const keywords = makeKeywords(src);
	const acceptNullable = !!src.acceptNullable;
	const maxRetries = 3;

	try {
		// Progressive delays: first call 10-15s, subsequent calls 5-10s
		if (shouldDelay) {
			const baseDelay = retryCount === 0 ? 10000 : 5000;
			const randomDelay = retryCount === 0 ? 5000 : 5000;
			await sleep(baseDelay, randomDelay);
		}

		const response = await axios.get(`https://api.bgpview.io/asn/${src.asn}/prefixes`, {
			timeout: 30000,
			headers: { 'Accept': 'application/json' },
		});

		const { data } = response;
		if (!data || data.status !== 'ok' || !data.data) {
			logger.warn(`Invalid BGPView response for ${src.asn} (status: ${data?.status})`);
			return [];
		}

		const all = [
			...(Array.isArray(data.data.ipv4_prefixes) ? data.data.ipv4_prefixes : []),
			...(Array.isArray(data.data.ipv6_prefixes) ? data.data.ipv6_prefixes : []),
		];

		const result = [];
		const mismatches = [];
		for (const p of all) {
			if (!p || !p.prefix) continue;

			if (!parseIP(p.prefix)) {
				logger.warn(`Invalid IP prefix from BGPView: ${p.prefix} (ASN ${src.asn})`);
				continue;
			}

			const nameNull = p.name == null;
			const descNull = p.description == null;
			if (!acceptNullable && nameNull && descNull) continue;

			if (acceptNullable && nameNull && descNull) {
				result.push({ ip: p.prefix, source: 'bgpview.io' });
				continue;
			}

			const owner = `${p.name || ''} ${p.description || ''}`.toLowerCase();
			if (keywords.some(k => owner.includes(k))) {
				result.push({ ip: p.prefix, source: 'bgpview.io' });
			} else {
				mismatches.push(`${p.prefix} (${p.name || 'N/A'}/${p.description || 'N/A'})`);
			}
		}

		if (mismatches.length > 0) {
			logger.debug(`BGPView keyword mismatches for ASN ${src.asn}: ${mismatches.length} prefixes - ${mismatches.slice(0, 3).join(', ')}${mismatches.length > 3 ? '...' : ''}`);
		}

		return result;
	} catch (err) {
		// Handle rate limiting with exponential backoff
		if (err.response && err.response.status === 429 && retryCount < maxRetries) {
			const backoffDelay = Math.pow(2, retryCount) * 30000; // 30s, 60s, 120s
			logger.warn(`BGPView rate limit hit for ASN ${src.asn}, retrying in ${backoffDelay / 1000}s (attempt ${retryCount + 1}/${maxRetries})`);
			await sleep(backoffDelay, 0);
			return fetchFromBGPView(src, false, retryCount + 1);
		}

		logger.err(`BGPView fetch failed for ASN ${src.asn}: ${err.message}`);
		return [];
	}
};

module.exports = async src => {
	const asns = Array.isArray(src.asn) ? src.asn : [src.asn];
	const allResults = [];

	logger.info(`Starting WHOIS lookup for ${src.name} (${asns.length} ASNs)`);

	for (let i = 0; i < asns.length; i++) {
		const asn = asns[i];
		if (!asn || typeof asn !== 'string') {
			logger.warn(`Invalid ASN format: ${asn} at index ${i}`);
			continue;
		}

		const asnNorm = String(asn).toUpperCase().replace(/^AS/, '');
		const srcWithSingleAsn = { ...src, asn: asnNorm };

		if (i > 0) await sleep(5000);

		try {
			const [bgpviewResult, whoisResults] = await Promise.allSettled([
				fetchFromBGPView(srcWithSingleAsn, i === 0),
				Promise.allSettled(WHOIS_HOSTS.map(host => fetchRoutesFromHost(asnNorm, host))),
			]);

			const bgpviewRoutes = bgpviewResult.status === 'fulfilled' ? bgpviewResult.value : [];
			const whoisRoutes = whoisResults.status === 'fulfilled'
				? whoisResults.value
					.filter(r => r.status === 'fulfilled')
					.flatMap(r => r.value)
				: [];

			allResults.push(...bgpviewRoutes, ...whoisRoutes);
			logger.info(`Processed ASN ${asnNorm}: ${bgpviewRoutes.length} BGPView + ${whoisRoutes.length} WHOIS = ${bgpviewRoutes.length + whoisRoutes.length} total`);
		} catch (err) {
			logger.err(`Failed to process ASN ${asnNorm}: ${err.message}`);
		}
	}

	const uniqueMap = new Map();
	for (const r of allResults) {
		if (r && r.ip && !uniqueMap.has(r.ip)) {
			uniqueMap.set(r.ip, r);
		}
	}

	return Array.from(uniqueMap.values())
		.sort((a, b) => compareIPs(a.ip, b.ip))
		.map(({ ip, source }) => ({
			ip,
			source,
		}));
};