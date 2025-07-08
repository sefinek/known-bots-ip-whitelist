const ipaddr = require('ipaddr.js');

const parseIP = ip => {
	try {
		if (ip.includes('/')) return ipaddr.parseCIDR(ip)[0];
		return ipaddr.parse(ip);
	} catch {
		return null;
	}
};

const compareIPs = (a, b) => {
	const A = parseIP(a) || { toByteArray: () => [] };
	const B = parseIP(b) || { toByteArray: () => [] };
	const aBytes = A.toByteArray();
	const bBytes = B.toByteArray();
	for (let i = 0, len = Math.max(aBytes.length, bBytes.length); i < len; i++) {
		const diff = (aBytes[i] || 0) - (bBytes[i] || 0);
		if (diff) return diff;
	}
	return a.localeCompare(b);
};

module.exports = { parseIP, compareIPs };