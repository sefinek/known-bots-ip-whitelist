const net = require('node:net');
const ipaddr = require('ipaddr.js');
const axios = require('./axios.js');

const WHOIS_HOSTS = ['whois.radb.net', 'whois.arin.net'];
const WHOIS_PORT = 43;

const parseIP = ip => {
	try {
		return ip.includes('/') ? ipaddr.parseCIDR(ip)[0] : ipaddr.parse(ip);
	} catch {
		return null;
	}
};

const compareIPs = (a, b) => {
	const toBytes = ip => {
		const parsed = parseIP(ip);
		return parsed ? parsed.toByteArray() : [];
	};

	const aB = toBytes(a);
	const bB = toBytes(b);
	for (let i = 0, len = Math.max(aB.length, bB.length); i < len; i++) {
		const diff = (aB[i] || 0) - (bB[i] || 0);
		if (diff) return diff;
	}

	return a.localeCompare(b);
};

const fetchRoutesFromHost = async (asn, host) => {
	return await new Promise(resolve => {
		let buf = '';
		const sock = net.createConnection(WHOIS_PORT, host);
		sock.setEncoding('utf8');

		const req =
			host === 'whois.arin.net'
				? `AS${asn.replace(/^AS/i, '')}\r\n`
				: `-i origin AS${asn.replace(/^AS/i, '')}\r\n`;

		sock.on('data', chunk => (buf += chunk));
		sock.on('error', () => resolve([]));
		sock.on('end', () => {
			const routes = buf.split(/\r?\n/).reduce((acc, line) => {
				if ((/^route6?:/i).test(line)) {
					acc.push({
						ip: line.replace(/^route6?:/i, '').trim(),
						source: host,
					});
				}
				return acc;
			}, []);
			resolve(routes);
		});
		sock.write(req, () => sock.end());
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

const fetchFromBGPView = async src => {
	const keywords = makeKeywords(src);
	const acceptNullable = !!src.acceptNullable;

	try {
		await sleep(1500, 2000);
		const { data } = await axios.get(`https://api.bgpview.io/asn/${src.asn}/prefixes`);
		if (data.status !== 'ok' || !data.data) return [];

		const all = [
			...(data.data.ipv4_prefixes || []),
			...(data.data.ipv6_prefixes || []),
		];

		const result = [];
		for (const p of all) {
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
				console.log(`BGPView MISMATCH -> ASN: ${src.asn}; IP: ${p.prefix}; Got: "${p.name}" / "${p.description}" (SKIPPED)`);
			}
		}
		return result;
	} catch (err) {
		console.error(`BGPView ERROR -> ASN: ${src.asn};`, err.stack);
		return [];
	}
};

module.exports = async src => {
	const asns = Array.isArray(src.asn) ? src.asn : [src.asn];
	const allResults = [];

	for (let i = 0; i < asns.length; i++) {
		const asn = asns[i];
		const asnNorm = String(asn).toUpperCase().replace(/^AS/, '');
		const srcWithSingleAsn = { ...src, asn };

		if (i > 0) await sleep(2000);

		const [bgpviewRoutes, whoisRoutesArray] = await Promise.all([
			fetchFromBGPView(srcWithSingleAsn),
			Promise.all(WHOIS_HOSTS.map(host => fetchRoutesFromHost(asnNorm, host))),
		]);

		const whoisRoutes = whoisRoutesArray.flat();
		allResults.push(...bgpviewRoutes, ...whoisRoutes);
	}

	const uniqueMap = new Map();
	for (const r of allResults) {
		if (!uniqueMap.has(r.ip)) uniqueMap.set(r.ip, r);
	}

	const asnDisplay = Array.isArray(src.asn) ? src.asn.join(',') : src.asn;
	return Array.from(uniqueMap.values())
		.sort((a, b) => compareIPs(a.ip, b.ip))
		.map(({ ip, source }) => ({
			ip,
			name: asnDisplay,
			source,
		}));
};