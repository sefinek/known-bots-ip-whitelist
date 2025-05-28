const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const ipaddr = require('ipaddr.js');

puppeteer.use(StealthPlugin());

const getYandexIPs = async () => {
	const browser = await puppeteer.launch({
		headless: 'new',
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-blink-features=AutomationControlled',
		],
	});

	const page = await browser.newPage();
	await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36');
	await page.setExtraHTTPHeaders({ 'Accept-Language': 'pl,en;q=0.9' });

	await page.goto('https://yandex.com/ips', { waitUntil: 'domcontentloaded' });

	const $ = cheerio.load(await page.content());
	const ips = [];

	$('.lc-features__description .lc-rich-text span').each((_, el) => {
		const text = $(el).text().trim();
		const [addr, prefix] = text.split('/');
		if (!prefix) return;

		try {
			const parsed = ipaddr.parse(addr);
			if (parsed.kind() === 'ipv4' || parsed.kind() === 'ipv6') ips.push(text);
		} catch {}
	});

	await browser.close();
	console.log(ips);
	return ips;
};

module.exports = getYandexIPs;

(async () => getYandexIPs())();