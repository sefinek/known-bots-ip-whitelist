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
	const aB = toBytes(a), bB = toBytes(b);
	for (let i = 0, len = Math.max(aB.length, bB.length); i < len; i++) {
		const diff = (aB[i] || 0) - (bB[i] || 0);
		if (diff) return diff;
	}
	return a.localeCompare(b);
};

const fetchRoutesFromHost = async (asn, host) => {
	let buf = '';
	return await new Promise(resolve => {
		const sock = net.createConnection(WHOIS_PORT, host);
		sock.setEncoding('utf8');

		const writeReq = host === 'whois.arin.net'
			? `AS${asn.replace(/^AS/, '')}\r\n`
			: `-i origin ${asn}\r\n`;

		sock.on('data', chunk => buf += chunk);
		sock.on('error', () => resolve([]));
		sock.on('end', () => {
			const routes = buf
				.split(/\r?\n/)
				.reduce((acc, line) => {
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
		sock.write(writeReq);
		sock.end();
	});
};

const makeKeywords = src => {
	let arr = [];
	if (src.analyzeKeywords && Array.isArray(src.keywords) && src.keywords.length) {
		arr = src.keywords.map(k => String(k || '').toLowerCase());
	}
	arr.push(String(src.name || '').toLowerCase());
	arr.push(String(src.dir || '').toLowerCase());
	return Array.from(new Set(arr.filter(Boolean)));
};

const fetchFromBGPView = async src => {
	const keywords = makeKeywords(src);
	const allNullable = !!src.allNullable;

	try {
		const { data } = await axios.get(`https://api.bgpview.io/asn/${src.asn}/prefixes`);
		if (data.status !== 'ok' || !data.data) return [];

		const ipv4 = (data.data.ipv4_prefixes || []).map(p => ({
			ip: p.prefix,
			source: 'bgpview.io',
			name: p.name,
			description: p.description,
		}));
		const ipv6 = (data.data.ipv6_prefixes || []).map(p => ({
			ip: p.prefix,
			source: 'bgpview.io',
			name: p.name,
			description: p.description,
		}));

		const result = [];
		for (const p of [...ipv4, ...ipv6]) {
			if (p.name == null || p.description == null) {
				result.push({ ip: p.ip, source: p.source });
				continue;
			}
			const owner = (String(p.name) + ' ' + String(p.description)).toLowerCase();
			const isMatch = keywords.some(k => owner.includes(k));
			if (isMatch) {
				result.push({ ip: p.ip, source: p.source });
			} else {
				console.log(`BGPView MISMATCH -> ASN: ${src.asn}; IP: ${p.ip}; Got: "${p.name}" / "${p.description}"`);
			}
		}
		return result;
	} catch (err) {
		console.error(`BGPView ERROR -> ASN: ${src.asn};`, err);
		return [];
	}
};

module.exports = async src => {
	const asnNorm = String(src.asn).toUpperCase().replace(/^AS/, '');
	const asnInput = `AS${asnNorm}`;
	const [bgpviewRoutes, whoisRoutesArray] = await Promise.all([
		fetchFromBGPView(src),
		Promise.all(WHOIS_HOSTS.map(host => fetchRoutesFromHost(asnInput, host))),
	]);

	const whoisRoutes = whoisRoutesArray.flat();
	const allRoutes = [...bgpviewRoutes, ...whoisRoutes];
	const uniqueMap = new Map();
	for (const r of allRoutes) {
		if (!uniqueMap.has(r.ip)) uniqueMap.set(r.ip, r);
	}

	const unique = Array.from(uniqueMap.values()).sort((a, b) => compareIPs(a.ip, b.ip));
	return unique.map(({ ip, source }) => ({
		ip,
		name: asnInput,
		source,
	}));
};