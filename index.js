const fs = require('node:fs/promises');
const path = require('node:path');
const axios = require('axios');
const ipaddr = require('ipaddr.js');
const { stringify } = require('csv-stringify/sync');
const getASNPrefixes = require('./scripts/get-asn-prefixes.js');

const sources = [
	{ name: 'GoogleBot', dir: 'googlebot', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', type: 'jsonPrefixes' },
	{ name: 'Google Special Crawlers', dir: 'google-special-crawlers', url: 'https://developers.google.com/search/apis/ipranges/special-crawlers.json', type: 'jsonPrefixes' },
	{ name: 'BingBot', dir: 'bingbot', url: 'https://www.bing.com/toolbox/bingbot.json', type: 'jsonPrefixes' },
	{ name: 'AhrefsBot', dir: 'ahrefsbot', url: 'https://api.ahrefs.com/v3/public/crawler-ips', type: 'jsonIps' },
	{ name: 'FacebookBot', dir: 'facebookbot', asn: 'AS32934', type: 'radb' },
	{ name: 'DuckDuckBot', dir: 'duckduckbot', url: 'https://raw.githubusercontent.com/duckduckgo/duckduckgo-help-pages/master/_docs/results/duckduckbot.md', type: 'mdList' },
	{ name: 'TelegramBot', dir: 'telegrambot', url: 'https://core.telegram.org/resources/cidr.txt', type: 'hosts' },
	{ name: 'UptimeRobot', dir: 'uptimerobot', url: 'https://uptimerobot.com/inc/files/ips/IPv4andIPv6.txt', type: 'hosts' },
	{ name: 'PingdomBot', dir: 'pingdombot', url: ['https://my.pingdom.com/probes/ipv4', 'https://my.pingdom.com/probes/ipv6'], type: 'textMulti' },
	{ name: 'Stripe', dir: 'stripewebhook', url: 'https://stripe.com/files/ips/ips_webhooks.txt', type: 'hosts' },
	{ name: 'RSS API', dir: 'rssapi', url: 'https://rssapi.net/ips.txt', type: 'hosts' },
	{ name: 'Better Uptime Bot', dir: 'betteruptimebot', url: 'https://betteruptime.com/ips.txt', type: 'hosts' },
	{ name: 'WebPageTest Bot', dir: 'webpagetestbot', url: 'https://www.webpagetest.org/addresses.php?f=json', type: 'jsonAddresses' },
	{ name: 'Bunny CDN', dir: 'bunnycdn', url: ['https://api.bunny.net/system/edgeserverlist/plain', 'https://api.bunny.net/system/edgeserverlist/ipv6'], type: 'textMulti' },
	{ name: 'Cloudflare', dir: 'cloudflare', url: ['https://www.cloudflare.com/ips-v4', 'https://www.cloudflare.com/ips-v6'], type: 'textMulti' },
	{ name: 'Palo Alto Networks', dir: 'paloaltonetworks', asn: 'AS54538', type: 'radb' },
	{ name: 'Shodan', dir: 'shodan', url: 'https://gist.githubusercontent.com/sefinek/c4a0630324412447cacab94cbccdd58e/raw/shodan.ips', type: 'hosts' },
];

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

const fetchSource = async src => {
	let out = [];

	if (src.type === 'radb') {
		if (!src.asn) throw new Error(`Missing ASN for ${src.name}`);
		out = await getASNPrefixes(src.asn);
	} else {
		try {
			if (src.type === 'hosts') {
				const data = await axios.get(src.url).then(r => r.data);
				out = data
					.split(/\r?\n/)
					.map(l => l.trim())
					.filter(Boolean)
					.map(ip => ({ ip, source: src.url }));
			} else if (src.type === 'textMulti') {
				for (const u of src.url) {
					const d = await axios.get(u).then(r => r.data);
					if (typeof d === 'string') {
						d
							.split(/\r?\n/)
							.map(l => l.trim())
							.filter(Boolean)
							.forEach(ip => out.push({ ip, source: u }));
					} else if (Array.isArray(d)) {
						d
							.map(String)
							.map(l => l.trim())
							.filter(Boolean)
							.forEach(ip => out.push({ ip, source: u }));
					}
				}
			} else if (src.type === 'jsonPrefixes') {
				const data = await axios.get(src.url).then(r => r.data);
				(data.prefixes || [])
					.map(p => p.ipv4Prefix || p.ipv6Prefix)
					.filter(Boolean)
					.forEach(ip => out.push({ ip, source: src.url }));
			} else if (src.type === 'jsonIps') {
				const data = await axios.get(src.url).then(r => r.data);
				(data.ips || [])
					.map(o => o.ip_address)
					.filter(Boolean)
					.forEach(ip => out.push({ ip, source: src.url }));
			} else if (src.type === 'jsonAddresses') {
				const data = await axios.get(src.url).then(r => r.data);
				Object.values(data.data || {})
					.flatMap(d => d.addresses || [])
					.filter(Boolean)
					.forEach(ip => out.push({ ip, source: src.url }));
			} else if (src.type === 'mdList') {
				const data = await axios.get(src.url).then(r => r.data);
				data
					.split(/\r?\n/)
					.filter(l => l.startsWith('- '))
					.map(l => l.replace(/^- /, '').trim())
					.forEach(ip => out.push({ ip, source: src.url }));
			}
		} catch (err) {
			console.error(`Error fetching ${src.name}:`, err.stack);
		}
	}

	out = Array.from(new Map(out.map(r => [`${r.ip}|${r.source}`, r])).values());

	console.log(`Collected ${out.length} IPs for ${src.name}`);
	return out;
};

const writeMeta = async (file, list) => {
	const prefixes = list
		.map(ip => ({
			ipv4Prefix: ip.includes('/') && !ip.includes(':') ? ip : undefined,
			ipv6Prefix: ip.includes(':') ? ip : undefined,
		}))
		.filter(p => p.ipv4Prefix || p.ipv6Prefix);

	const exists = await fs.stat(file).then(() => true).catch(() => false);
	if (exists) {
		const existing = JSON.parse(await fs.readFile(file, 'utf8'));
		if (JSON.stringify(existing.prefixes) === JSON.stringify(prefixes)) {
			console.log('Meta unchanged, skip write');
			return;
		}
	}

	const newMeta = { creationTime: new Date().toISOString(), prefixes };
	await fs.writeFile(file, JSON.stringify(newMeta, null, 2), 'utf8');
};

(async () => {
	const base = path.join(__dirname, 'lists');
	await fs.mkdir(base, { recursive: true });
	const allMap = new Map();

	for (const src of sources) {
		console.log(`> Processing ${src.name}...`);
		const records = (await fetchSource(src)).sort((a, b) => compareIPs(a.ip, b.ip));
		const dir = path.join(base, src.dir);
		await fs.mkdir(dir, { recursive: true });

		await fs.writeFile(
			path.join(dir, 'ips.txt'),
			records.map(r => r.ip).join('\n') + '\n',
			'utf8'
		);

		await fs.writeFile(
			path.join(dir, 'ips.csv'),
			stringify(records.map(r => ({ IP: r.ip, Name: src.name, Source: r.source })), { header: true, columns: ['IP', 'Name', 'Source'] }),
			'utf8'
		);

		await fs.writeFile(
			path.join(dir, 'ips.simple.json'),
			JSON.stringify(records.map(r => ({ ip: r.ip, name: src.dir, source: r.source })), null, 2),
			'utf8'
		);

		await writeMeta(path.join(dir, 'ips.meta.json'), records.map(r => r.ip));

		records.forEach(r => {
			if (!allMap.has(r.ip)) allMap.set(r.ip, { Name: src.name, Source: r.source });
		});
	}

	console.log('> Writing global lists');
	const globalRecs = Array.from(allMap.entries())
		.map(([IP, info]) => ({ IP, Name: info.Name, Source: info.Source }))
		.sort((a, b) => compareIPs(a.IP, b.IP));

	await fs.writeFile(path.join(base, 'all-safe-ips.txt'), globalRecs.map(r => r.IP).join('\n') + '\n', 'utf8');
	await writeMeta(path.join(base, 'all-safe-ips.meta.json'), globalRecs.map(r => r.IP));
	await fs.writeFile(path.join(base, 'all-safe-ips.simple.json'), JSON.stringify(globalRecs, null, 2), 'utf8');
	await fs.writeFile(path.join(base, 'all-safe-ips.csv'), stringify(globalRecs, { header: true, columns: ['IP', 'Name', 'Source'] }), 'utf8');

	console.log(`Generation complete: ${globalRecs.length} IPs total`);
})();