const ipaddr = require('ipaddr.js');

const parseIP = ip => {
	if (!ip || typeof ip !== 'string') return null;

	try {
		const trimmed = ip.trim();
		if (!trimmed) return null;
		if (trimmed.includes('/')) {
			const [addr, prefix] = trimmed.split('/');
			const prefixNum = parseInt(prefix, 10);
			if (isNaN(prefixNum) || prefixNum < 0) return null;
			if (ipaddr.IPv4.isValid(addr) && (prefixNum > 32)) return null;
			if (ipaddr.IPv6.isValid(addr) && (prefixNum > 128)) return null;
			return ipaddr.parseCIDR(trimmed)[0];
		}
		return ipaddr.parse(trimmed);
	} catch {
		return null;
	}
};

const isValidIP = ip => {
	if (!ip || typeof ip !== 'string') return false;

	try {
		const trimmed = ip.trim();
		if (!trimmed) return false;
		if (trimmed.includes('/')) {
			ipaddr.parseCIDR(trimmed);
			return true;
		}
		return ipaddr.isValid(trimmed);
	} catch {
		return false;
	}
};

const compareIPs = (a, b) => {
	if (!a || !b) return (a || '').localeCompare(b || '');

	const A = parseIP(a);
	const B = parseIP(b);

	if (!A && !B) return a.localeCompare(b);
	if (!A) return 1;
	if (!B) return -1;

	try {
		const aKind = A.kind();
		const bKind = B.kind();
		if (aKind !== bKind) return aKind === 'ipv4' ? -1 : 1;

		const aBytes = A.toByteArray();
		const bBytes = B.toByteArray();

		for (let i = 0; i < Math.max(aBytes.length, bBytes.length); i++) {
			const diff = (aBytes[i] || 0) - (bBytes[i] || 0);
			if (diff !== 0) return diff;
		}

		if (a.includes('/') && b.includes('/')) {
			const [, prefixA] = a.split('/');
			const [, prefixB] = b.split('/');
			return parseInt(prefixA, 10) - parseInt(prefixB, 10);
		}

		return a.localeCompare(b);
	} catch {
		return a.localeCompare(b);
	}
};

const isPrivateIP = ip => {
	const parsed = parseIP(ip);
	if (!parsed) return false;

	try {
		return parsed.range() === 'private' || parsed.range() === 'loopback' || parsed.range() === 'linkLocal';
	} catch {
		return false;
	}
};

const parseCIDREntry = cidr => {
	try {
		const [addr, prefix] = ipaddr.parseCIDR(cidr.trim());
		return { cidr, addr, prefix };
	} catch {
		return null;
	}
};

const findCoveringCIDR = (ip, parsedCIDRs) => {
	try {
		const parsed = ipaddr.parse(ip.trim());
		const kind = parsed.kind();
		return parsedCIDRs.find(c => c.addr.kind() === kind && parsed.match(c.addr, c.prefix));
	} catch {
		return null;
	}
};

module.exports = {
	parseIP,
	isValidIP,
	compareIPs,
	isPrivateIP,
	parseCIDREntry,
	findCoveringCIDR,
};