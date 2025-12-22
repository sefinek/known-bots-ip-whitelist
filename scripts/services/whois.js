const net = require('node:net');
const { parseIP, compareIPs } = require('../ipUtils.js');
const fetchFromRIPEstat = require('./ripestat.js');

const logger = require('../utils/logger.js');

const WHOIS_HOSTS = ['whois.radb.net', 'whois.arin.net'];
const WHOIS_PORT = 43;

const normalizeKeywords = keywords => (
	Array.isArray(keywords)
		? keywords.filter(k => typeof k === 'string' && k.trim()).map(k => k.toLowerCase())
		: []
);

const extractRouteBlocks = buffer => {
	const lines = buffer.split(/\r?\n/);
	const blocks = [];
	let currentIp = null;
	let metaLines = [];

	const flush = () => {
		if (!currentIp) return;
		blocks.push({ ip: currentIp, metaLines: [...metaLines] });
		currentIp = null;
		metaLines = [];
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			flush();
			continue;
		}

		if ((/^route6?:/i).test(trimmed)) {
			flush();
			currentIp = trimmed.replace(/^route6?:/i, '').trim();
			continue;
		}

		if (currentIp) metaLines.push(trimmed);
	}

	flush();
	return blocks;
};

const filterBlocksByKeywords = (blocks, keywords, acceptNullable) => {
	const normalized = normalizeKeywords(keywords);
	if (!normalized.length) return blocks;

	const enriched = blocks.map(block => {
		const metaText = block.metaLines.join(' ').toLowerCase();
		return { ...block, metaText, hasMeta: block.metaLines.length > 0 };
	});

	const matches = enriched.filter(block => normalized.some(k => block.metaText.includes(k)));
	if (matches.length) {
		if (!acceptNullable) return matches;

		const matchedIps = new Set(matches.map(block => block.ip));
		const nullable = enriched.filter(block => !block.hasMeta && !matchedIps.has(block.ip));
		return [...matches, ...nullable];
	}

	return acceptNullable ? enriched : [];
};

const fetchRoutesFromHost = async (asn, host, options = {}) => {
	return new Promise(resolve => {
		let buffer = '';
		let hasResolved = false;
		const sock = net.createConnection(WHOIS_PORT, host);
		sock.setEncoding('utf8');
		sock.setTimeout(30000);

		const safeResolve = data => {
			if (!hasResolved) {
				hasResolved = true;
				resolve(data);
			}
		};

		const asnClean = asn.replace(/^AS/i, '');
		const req = host === 'whois.arin.net'
			? `AS${asnClean}\r\n`
			: `-i origin AS${asnClean}\r\n`;

		sock.on('data', chunk => {
			buffer += chunk;
			if (buffer.length > 10 * 1024 * 1024) {
				logger.warn(`Response too large from ${host}, truncating`);
				sock.destroy();
				safeResolve([]);
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
				const blocks = extractRouteBlocks(buffer);
				const filtered = filterBlocksByKeywords(blocks, options.keywords, options.acceptNullable);
				const routes = [];

				for (const block of filtered) {
					if (!block.ip || !parseIP(block.ip)) continue;
					routes.push({ ip: block.ip, source: host });
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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async src => {
	const asns = Array.isArray(src.asn) ? src.asn : [src.asn];
	const ripestatResults = [];
	const whoisResults = [];
	const keywords = normalizeKeywords(src.keywords);
	const acceptNullable = Boolean(src.acceptNullable);

	logger.debug(`Starting BGP lookup for ${src.name} (${asns.length} ASNs)`);

	for (let i = 0; i < asns.length; i++) {
		const asn = asns[i];
		if (!asn || typeof asn !== 'string') {
			logger.warn(`Invalid ASN format: ${asn} at index ${i}`);
			continue;
		}

		const asnNorm = String(asn).toUpperCase().replace(/^AS/, '');
		const srcWithSingleAsn = { ...src, asn: asnNorm };

		if (i > 0) await sleep(2000);

		try {
			const [ripestat, whois] = await Promise.allSettled([
				fetchFromRIPEstat(srcWithSingleAsn, i === 0),
				Promise.allSettled(WHOIS_HOSTS.map(host => fetchRoutesFromHost(asnNorm, host, { keywords, acceptNullable }))),
			]);

			const ripeRoutes = ripestat.status === 'fulfilled' ? ripestat.value : [];
			const filteredRipeRoutes = (keywords.length && !acceptNullable) ? [] : ripeRoutes;
			const whoisRoutes = whois.status === 'fulfilled'
				? whois.value
					.filter(r => r.status === 'fulfilled')
					.flatMap(r => r.value)
				: [];

			ripestatResults.push(...filteredRipeRoutes);
			whoisResults.push(...whoisRoutes);

			logger.success(`Processed AS${asnNorm} for ${src.name}: ${filteredRipeRoutes.length} RIPEstat + ${whoisRoutes.length} WHOIS = ${filteredRipeRoutes.length + whoisRoutes.length} total`);
		} catch (err) {
			logger.err(`Failed to process ASN ${asnNorm}: ${err.message}`);
		}
	}

	const ipMap = new Map();

	for (const r of ripestatResults) {
		if (!r?.ip) continue;
		const sources = ipMap.get(r.ip) || [];
		sources.push(r.source);
		ipMap.set(r.ip, sources);
	}

	for (const r of whoisResults) {
		if (!r?.ip) continue;
		const sources = ipMap.get(r.ip) || [];
		sources.push(r.source);
		ipMap.set(r.ip, sources);
	}

	return Array.from(ipMap.entries())
		.map(([ip, sources]) => ({
			ip,
			sources: [...new Set(sources)],
		}))
		.sort((a, b) => compareIPs(a.ip, b.ip));
};
