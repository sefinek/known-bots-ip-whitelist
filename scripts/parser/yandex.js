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
			'--window-size=1920,1080',
			'--blink-settings=imagesEnabled=false',
		],
	});

	try {
		const page = await browser.newPage();
		await page.goto('https://yandex.com/ips', { waitUntil: 'domcontentloaded' });

		const $ = cheerio.load(await page.content());
		const ips = [];

		$('.lc-features__description .lc-rich-text span').each((_, el) => {
			const text = $(el).text().trim();
			if (!text.includes('/')) return;

			const [addr, prefix] = text.split('/');
			if (!prefix) return;

			if (ipaddr.isValid(addr)) ips.push(text);
		});

		console.log(ips);
		return ips;
	} finally {
		await browser.close();
	}
};

module.exports = getYandexIPs;

if (require.main === module) getYandexIPs().then(console.log).catch(console.error);