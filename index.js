const fs = require('node:fs/promises');
const path = require('node:path');
const axios = require('axios');
const ipaddr = require('ipaddr.js');
const { stringify } = require('csv-stringify/sync');

const sources = [
	{ name: 'Bingbot', dir: 'bingbot', url: 'https://www.bing.com/toolbox/bingbot.json', type: 'json' },
	{ name: 'Cloudflare IPv4', dir: 'cloudflare-ipv4', url: 'https://www.cloudflare.com/ips-v4', type: 'text' },
	{ name: 'Cloudflare IPv6', dir: 'cloudflare-ipv6', url: 'https://www.cloudflare.com/ips-v6', type: 'text' },
	{ name: 'Googlebot', dir: 'googlebot', url: 'https://developers.google.com/search/apis/ipranges/googlebot.json', type: 'json' },
	{ name: 'Google Special Crawlers', dir: 'google-special-crawlers', url: 'https://developers.google.com/search/apis/ipranges/special-crawlers.json', type: 'json' },
];

const parseIP = ip => {
	try {
		if (ip.includes('/')) {
			return ipaddr.parseCIDR(ip)[0];
		}
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

	const length = Math.max(aBytes.length, bBytes.length);
	for (let i = 0; i < length; i++) {
		const diff = (aBytes[i] || 0) - (bBytes[i] || 0);
		if (diff) return diff;
	}

	return a.localeCompare(b);
};

const fetchSource = async ({ name, url, type }) => {
	console.log(`Fetching ${type.toUpperCase()} from ${name}`);
	try {
		const { data } = await axios.get(url);

		if (type === 'text') {
			return data
				.split(/\r?\n/)
				.map(line => line.trim())
				.filter(line => line);
		}

		if (Array.isArray(data.prefixes)) {
			return data.prefixes
				.map(p => p.ipv4Prefix || p.ipv6Prefix)
				.filter(prefix => prefix);
		}

		return [];
	} catch {
		return [];
	}
};

const writeMeta = async (file, prefixes) => {
	const exists = await fs
		.stat(file)
		.then(() => true)
		.catch(() => false);

	let creationTime = new Date().toISOString();

	if (exists) {
		const existing = JSON.parse(await fs.readFile(file, 'utf8'));
		const oldList = (existing.prefixes || [])
			.map(p => p.ipv4Prefix || p.ipv6Prefix)
			.sort();
		const newList = [...prefixes].sort();

		if (oldList.length === newList.length && oldList.every((v, i) => v === newList[i])) {
			creationTime = existing.creationTime;
		}
	}

	const meta = {
		creationTime,
		prefixes: prefixes
			.map(ip => ({
				ipv4Prefix: ip.includes('/') && !ip.includes(':') ? ip : undefined,
				ipv6Prefix: ip.includes(':') ? ip : undefined,
			}))
			.filter(p => p.ipv4Prefix || p.ipv6Prefix),
	};

	await fs.writeFile(file, JSON.stringify(meta, null, 2), 'utf8');
};

(async () => {
	const base = path.join(__dirname, 'lists');
	await fs.mkdir(base, { recursive: true });

	const allMap = new Map();

	await Promise.all(
		sources.map(async src => {
			const entries = (await fetchSource(src)).sort(compareIPs);
			const dir = path.join(base, src.dir);

			await fs.mkdir(dir, { recursive: true });
			await fs.writeFile(path.join(dir, 'ips.txt'), entries.join('\n') + '\n', 'utf8');
			await fs.writeFile(path.join(dir, 'ips.csv'), stringify(entries.map(ip => ({ IP: ip, Name: src.name, Source: src.url })), { header: true, columns: ['IP', 'Name', 'Source'] }), 'utf8');
			await fs.writeFile(path.join(dir, 'ips.simple.json'), JSON.stringify(entries.map(ip => ({ ip, name: src.dir, source: src.url })), null, 2), 'utf8');
			await writeMeta(path.join(dir, 'ips.meta.json'), entries);

			entries.forEach(ip => {
				if (!allMap.has(ip)) allMap.set(ip, { Name: src.name, Source: src.url });
			});
		})
	);

	const records = Array.from(allMap, ([IP, info]) => ({
		IP,
		Name: info.Name,
		Source: info.Source,
	})).sort((a, b) => compareIPs(a.IP, b.IP));

	await fs.writeFile(path.join(base, 'all-safe-ips.txt'), records.map(r => r.IP).join('\n') + '\n', 'utf8');
	await writeMeta(path.join(base, 'all-safe-ips.meta.json'), records.map(r => r.IP));
	await fs.writeFile(path.join(base, 'all-safe-ips.simple.json'), JSON.stringify(records, null, 2), 'utf8');
	await fs.writeFile(path.join(base, 'all-safe-ips.csv'), stringify(records, { header: true, columns: ['IP', 'Name', 'Source'] }), 'utf8');

	console.log(`Wrote lists (${records.length} total)`);
})();