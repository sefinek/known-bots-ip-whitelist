const fs = require('node:fs/promises');
const path = require('node:path');
const { stringify } = require('csv-stringify/sync');
const fetchSource = require('./scripts/fetchSource.js');
const ipUtils = require('./scripts/ipUtils.js');

const sources = [
	{ name: 'AhrefsBot', dir: 'ahrefsbot', url: 'https://api.ahrefs.com/v3/public/crawler-ips', type: 'jsonIps' },
	{ name: 'Better Uptime Bot', dir: 'betteruptimebot', url: 'https://betteruptime.com/ips.txt', type: 'hosts' },
	{ name: 'BingBot', dir: 'bingbot', url: 'https://www.bing.com/toolbox/bingbot.json', type: 'jsonPrefixes' },
	{ name: 'Bunny CDN', dir: 'bunnycdn', url: ['https://api.bunny.net/system/edgeserverlist/plain', 'https://api.bunny.net/system/edgeserverlist/ipv6'], type: 'textMulti' },
	{ name: 'Cloudflare', dir: 'cloudflare', url: ['https://www.cloudflare.com/ips-v4', 'https://www.cloudflare.com/ips-v6'], type: 'textMulti' },
	{ name: 'DuckDuckBot', dir: 'duckduckbot', url: 'https://raw.githubusercontent.com/duckduckgo/duckduckgo-help-pages/master/_docs/results/duckduckbot.md', type: 'mdList' },
	{ name: 'FacebookBot', dir: 'facebookbot', asn: 'AS32934', type: 'radb' },
	{ name: 'Google Special Crawlers', dir: 'google-special-crawlers', url: 'https://developers.google.com/search/apis/ipranges/special-crawlers.json', type: 'jsonPrefixes' },
	{ name: 'GoogleBot', dir: 'googlebot', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', type: 'jsonPrefixes' },
	{ name: 'Palo Alto Networks', dir: 'paloaltonetworks', asn: 'AS54538', type: 'radb' },
	{ name: 'PingdomBot', dir: 'pingdombot', url: ['https://my.pingdom.com/probes/ipv4', 'https://my.pingdom.com/probes/ipv6'], type: 'textMulti' },
	{ name: 'RSS API', dir: 'rssapi', url: 'https://rssapi.net/ips.txt', type: 'hosts' },
	{ name: 'Shodan', dir: 'shodan', url: 'https://gist.githubusercontent.com/sefinek/c4a0630324412447cacab94cbccdd58e/raw/shodan.ips', type: 'hosts' },
	{ name: 'Stripe', dir: 'stripewebhook', url: 'https://stripe.com/files/ips/ips_webhooks.txt', type: 'hosts' },
	{ name: 'TelegramBot', dir: 'telegrambot', url: 'https://core.telegram.org/resources/cidr.txt', type: 'hosts' },
	{ name: 'UptimeRobot', dir: 'uptimerobot', url: 'https://uptimerobot.com/inc/files/ips/IPv4andIPv6.txt', type: 'hosts' },
	{ name: 'WebPageTest Bot', dir: 'webpagetestbot', url: 'https://www.webpagetest.org/addresses.php?f=json', type: 'jsonAddresses' },
	{ name: 'YandexBot', dir: 'yandexbot', type: 'yandex' },
];

(async () => {
	const base = path.join(__dirname, 'lists');
	await fs.mkdir(base, { recursive: true });
	const allMap = new Map();

	for (const src of sources) {
		console.log(`> Processing ${src.name}...`);
		const records = (await fetchSource(src)).sort((a, b) => ipUtils.compareIPs(a.ip, b.ip));
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
			path.join(dir, 'ips.json'),
			JSON.stringify(records.map(r => ({ ip: r.ip, name: src.dir, source: r.source })), null, 2),
			'utf8'
		);

		records.forEach(r => {
			if (!allMap.has(r.ip)) allMap.set(r.ip, { Name: src.name, Source: r.source });
		});
	}

	console.log('> Writing global lists');
	const globalRecs = Array.from(allMap.entries())
		.map(([IP, info]) => ({ IP, Name: info.Name, Source: info.Source }))
		.sort((a, b) => ipUtils.compareIPs(a.IP, b.IP));

	await fs.writeFile(path.join(base, 'all-safe-ips.txt'), globalRecs.map(r => r.IP).join('\n') + '\n', 'utf8');
	await fs.writeFile(path.join(base, 'all-safe-ips.json'), JSON.stringify(globalRecs, null, 2), 'utf8');
	await fs.writeFile(path.join(base, 'all-safe-ips.csv'), stringify(globalRecs, { header: true, columns: ['IP', 'Name', 'Source'] }), 'utf8');

	console.log(`Generation complete: ${globalRecs.length} IPs total`);
})();