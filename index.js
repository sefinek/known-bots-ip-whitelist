const fs = require('node:fs/promises');
const path = require('node:path');
const axios = require('axios');
const ipaddr = require('ipaddr.js');
const { stringify } = require('csv-stringify/sync');
const generateFacebook = require('./scripts/generate-facebookbot.js');

const sources = [
	{ name: 'GoogleBot', dir: 'googlebot', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', type: 'jsonPrefixes' },
	{ name: 'Google Special Crawlers', dir: 'google-special-crawlers', url: 'https://developers.google.com/search/apis/ipranges/special-crawlers.json', type: 'jsonPrefixes' },
	{ name: 'BingBot', dir: 'bingbot', url: 'https://www.bing.com/toolbox/bingbot.json', type: 'jsonPrefixes' },
	{ name: 'AhrefsBot', dir: 'ahrefsbot', url: 'https://api.ahrefs.com/v3/public/crawler-ips', type: 'jsonIps' },
	// { name: 'FacebookBot', dir: 'facebookbot', url: 'https://whois.radb.net/-i%20origin%20AS32934', type: 'radb' },
	{ name: 'DuckDuckBot', dir: 'duckduckbot', url: 'https://raw.githubusercontent.com/duckduckgo/duckduckgo-help-pages/master/_docs/results/duckduckbot.md', type: 'mdList' },
	{ name: 'TelegramBot', dir: 'telegrambot', url: 'https://core.telegram.org/resources/cidr.txt', type: 'text' },
	{ name: 'UptimeRobot', dir: 'uptimerobot', url: 'https://uptimerobot.com/inc/files/ips/IPv4andIPv6.txt', type: 'text' },
	{ name: 'PingdomBot', dir: 'pingdombot', url: ['https://my.pingdom.com/probes/ipv4', 'https://my.pingdom.com/probes/ipv6'], type: 'textMulti' },
	{ name: 'Stripe', dir: 'stripewebhook', url: 'https://stripe.com/files/ips/ips_webhooks.txt', type: 'text' },
	{ name: 'RSS API', dir: 'rssapi', url: 'https://rssapi.net/ips.txt', type: 'text' },
	{ name: 'Better Uptime Bot', dir: 'betteruptimebot', url: 'https://betteruptime.com/ips.txt', type: 'text' },
	{ name: 'WebPageTest Bot', dir: 'webpagetestbot', url: 'https://www.webpagetest.org/addresses.php?f=json', type: 'jsonAddresses' },
	{ name: 'Bunny CDN', dir: 'bunnycdn', url: ['https://api.bunny.net/system/edgeserverlist/plain', 'https://api.bunny.net/system/edgeserverlist/ipv6'], type: 'textMulti' },
	{ name: 'Cloudflare', dir: 'cloudflare', url: ['https://www.cloudflare.com/ips-v4', 'https://www.cloudflare.com/ips-v6'], type: 'textMulti' },
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
	console.log(`Downloading: ${src.url}`);

	let out = [];
	try {
		if (src.type === 'text') {
			const data = await axios.get(src.url).then(r => r.data);
			out = data.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
		} else if (src.type === 'textMulti') {
			for (const u of src.url) {
				const d = await axios.get(u).then(r => r.data);
				if (typeof d === 'string') {
					out.push(...d.split(/\r?\n/).map(l => l.trim()).filter(Boolean));
				} else if (Array.isArray(d)) {
					out.push(...d.map(String).map(l => l.trim()).filter(Boolean));
				}
			}
		} else if (src.type === 'jsonPrefixes') {
			const data = await axios.get(src.url).then(r => r.data);
			out = (data.prefixes || []).map(p => p.ipv4Prefix || p.ipv6Prefix).filter(Boolean);
		} else if (src.type === 'jsonIps') {
			const data = await axios.get(src.url).then(r => r.data);
			out = (data.ips || []).map(o => o.ip_address).filter(Boolean);
		} else if (src.type === 'jsonAddresses') {
			const data = await axios.get(src.url).then(r => r.data);
			out = Object.values(data.data || {}).flatMap(d => d.addresses || []).filter(Boolean);
		} else if (src.type === 'mdList') {
			const data = await axios.get(src.url).then(r => r.data);
			out = data.split(/\r?\n/).filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').trim());
		} else if (src.type === 'radb') {
			const data = await axios.get(src.url).then(r => r.data);
			out = data.split(/\r?\n/).filter(l => l.startsWith('route')).map(l => l.replace(/route6?:/, '').trim());
		}
	} catch (err) {
		console.error(`Error fetching ${src.name}:`, err.stack);
	}

	out = [...new Set(out)];
	console.log(`Collected ${out.length} IPs for ${src.name}`);
	return out;
};

const writeMeta = async (file, list) => {
	const prefixes = list.map(ip => ({
		ipv4Prefix: ip.includes('/') && !ip.includes(':') ? ip : undefined,
		ipv6Prefix: ip.includes(':') ? ip : undefined,
	})).filter(p => p.ipv4Prefix || p.ipv6Prefix);

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
		console.log(`> Processing ${src.name}`);
		const list = (await fetchSource(src)).sort(compareIPs);
		const dir = path.join(base, src.dir);
		await fs.mkdir(dir, { recursive: true });

		// TXT
		await fs.writeFile(path.join(dir, 'ips.txt'), list.join('\n') + '\n', 'utf8');

		// CSV
		await fs.writeFile(
			path.join(dir, 'ips.csv'),
			stringify(
				list.map(ip => ({ IP: ip, Name: src.name, Source: Array.isArray(src.url) ? src.url.join(',') : src.url })),
				{ header: true, columns: ['IP', 'Name', 'Source'] }
			),
			'utf8'
		);

		// <>.simple.json
		await fs.writeFile(
			path.join(dir, 'ips.simple.json'),
			JSON.stringify(list.map(ip => ({ ip, name: src.dir, source: src.url })), null, 2),
			'utf8'
		);

		// <>.meta.json
		await writeMeta(path.join(dir, 'ips.meta.json'), list);

		list.forEach(ip => {
			if (!allMap.has(ip)) {
				allMap.set(ip, { Name: src.name, Source: Array.isArray(src.url) ? src.url.join(',') : src.url });
			}
		});
	}

	// Global
	console.log('> Writing global lists');
	const records = Array.from(allMap.entries()).map(([IP, info]) => ({ IP, Name: info.Name, Source: info.Source }))
		.sort((a, b) => compareIPs(a.IP, b.IP));

	await fs.writeFile(path.join(base, 'all-safe-ips.txt'), records.map(r => r.IP).join('\n') + '\n', 'utf8');
	await writeMeta(path.join(base, 'all-safe-ips.meta.json'), records.map(r => r.IP));
	await fs.writeFile(path.join(base, 'all-safe-ips.simple.json'), JSON.stringify(records, null, 2), 'utf8');
	await fs.writeFile(path.join(base, 'all-safe-ips.csv'), stringify(records, { header:true, columns: ['IP', 'Name', 'Source'] }), 'utf8');

	console.log(`Generation complete: ${records.length} IPs total`);
})();