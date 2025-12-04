const net = require('node:net');
const { parseIP, compareIPs } = require('../ipUtils.js');
const fetchFromRIPEstat = require('./ripestat.js');

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

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = async src => {
	const asns = Array.isArray(src.asn) ? src.asn : [src.asn];
	const ripestatResults = [];
	const whoisResults = [];

	logger.info(`Starting BGP lookup for ${src.name} (${asns.length} ASNs)`);

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
				Promise.allSettled(WHOIS_HOSTS.map(host => fetchRoutesFromHost(asnNorm, host))),
			]);

			const ripeRoutes = ripestat.status === 'fulfilled' ? ripestat.value : [];
			const whoisRoutes = whois.status === 'fulfilled'
				? whois.value
					.filter(r => r.status === 'fulfilled')
					.flatMap(r => r.value)
				: [];

			ripestatResults.push(...ripeRoutes);
			whoisResults.push(...whoisRoutes);

			logger.info(`Processed AS${asnNorm}: ${ripeRoutes.length} RIPEstat + ${whoisRoutes.length} WHOIS = ${ripeRoutes.length + whoisRoutes.length} total`);
		} catch (err) {
			logger.err(`Failed to process ASN ${asnNorm}: ${err.message}`);
		}
	}

	const ipMap = new Map();

	for (const r of ripestatResults) {
		if (!r || !r.ip) continue;
		if (!ipMap.has(r.ip)) ipMap.set(r.ip, []);
		ipMap.get(r.ip).push(r.source);
	}

	for (const r of whoisResults) {
		if (!r || !r.ip) continue;
		if (!ipMap.has(r.ip)) ipMap.set(r.ip, []);
		ipMap.get(r.ip).push(r.source);
	}

	return Array.from(ipMap.entries())
		.map(([ip, sources]) => ({
			ip,
			sources: [...new Set(sources)],
		}))
		.sort((a, b) => compareIPs(a.ip, b.ip));
};