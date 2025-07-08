const axios = require('./axios.js');
const net = require('node:net');
const ipaddr = require('ipaddr.js');

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

const fetchRoutesFromHost = (asn, host) =>
	new Promise(resolve => {
		let buf = '';
		const sock = net.createConnection(WHOIS_PORT, host, () => {
			if (host === 'whois.arin.net') {
				sock.write(`AS${asn.replace(/^AS/, '')}\r\n`);
			} else {
				sock.write(`-i origin ${asn}\r\n`);
			}
			sock.end();
		});
		sock
			.on('data', chunk => buf += chunk)
			.on('end', () => {
				const routes = buf
					.split(/\r?\n/)
					.reduce((acc, line) => {
						if ((/^route6?:/i).test(line)) {acc.push({
							ip: line.replace(/^route6?:/i, '').trim(),
							source: host,
						});}
						return acc;
					}, []);
				resolve(routes);
			})
			.on('error', () => resolve([]));
	});

const fetchFromBGPView = async asn => {
	try {
		const { data } = await axios.get(`https://api.bgpview.io/asn/${asn}/prefixes`);
		if (data.status === 'ok') {
			const ipv4 = data.data.ipv4_prefixes.map(p => ({ ip: p.prefix, source: 'bgpview.io' }));
			const ipv6 = data.data.ipv6_prefixes.map(p => ({ ip: p.prefix, source: 'bgpview.io' }));
			return [...ipv4, ...ipv6];
		}
		return [];
	} catch {
		return [];
	}
};

module.exports = async asn => {
	const asnNorm = String(asn).toUpperCase().replace(/^AS/, '');
	const asnInput = `AS${asnNorm}`;
	const [bgpviewRoutes, whoisRoutesArray] = await Promise.all([
		fetchFromBGPView(asn),
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