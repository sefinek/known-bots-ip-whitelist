const net = require('node:net');
const ipaddr = require('ipaddr.js');

const AS_NUMBER = 'AS32934';
const WHOIS_HOST = 'whois.radb.net';
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

const fetchRoutes = () =>
	new Promise((resolve, reject) => {
		let buf = '';
		const sock = net.createConnection(WHOIS_PORT, WHOIS_HOST, () => {
			sock.write(`-i origin ${AS_NUMBER}\r\n`);
			sock.end();
		});
		sock
			.on('data', chunk => buf += chunk)
			.on('end', () => {
				const routes = buf
					.split(/\r?\n/)
					.reduce((acc, line) => {
						if ((/^route6?:/).test(line)) {
							acc.push(line.replace(/^route6?:/, '').trim());
						}
						return acc;
					}, []);
				resolve(routes);
			})
			.on('error', reject);
	});

const cleanAndSort = list =>
	[...new Set(list)].sort(compareIPs);

module.exports = async () => {
	const prefixes = cleanAndSort(await fetchRoutes());
	return prefixes.map(ip => ({
		ip,
		name: AS_NUMBER,
		source: WHOIS_HOST,
	}));
};