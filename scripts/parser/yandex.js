const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const ipaddr = require('ipaddr.js');

const logger = require('../utils/logger.js');

puppeteer.use(StealthPlugin());

const getYandexIPs = async () => {
	logger.info('Starting Yandex IP extraction');

	let browser;
	try {
		browser = await puppeteer.launch({
			headless: 'new',
			timeout: 30000,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-accelerated-2d-canvas',
				'--no-first-run',
				'--no-zygote',
				'--disable-gpu',
				'--window-size=1920,1080',
				'--blink-settings=imagesEnabled=false',
			],
		});

		const page = await browser.newPage();
		await page.setViewport({ width: 1920, height: 1080 });

		await page.goto('https://yandex.com/ips', {
			waitUntil: 'domcontentloaded',
			timeout: 30000,
		});

		await new Promise(resolve => setTimeout(resolve, 2000));

		const content = await page.content();
		if (!content || content.length < 100) {
			throw new Error('Failed to load page content');
		}

		const $ = cheerio.load(content);
		const ips = [];
		const selectors = [
			'.lc-features__description .lc-rich-text span',
			'.lc-rich-text span',
			'span',
			'p',
		];

		for (const selector of selectors) {
			$(selector).each((_, el) => {
				const text = $(el).text().trim();
				if (!text || !text.includes('/')) return;

				const [addr] = text.split('/');
				if (!addr || !ipaddr.isValid(addr.trim())) return;

				const ipWithCidr = text.trim();
				if (!ips.find(item => item.ip === ipWithCidr)) {
					ips.push({
						ip: ipWithCidr,
						source: 'https://yandex.com/ips',
					});
				}
			});
			if (ips.length > 0) break;
		}

		logger.info(`Yandex extraction completed: ${ips.length} IPs`);

		if (!ips.length) {
			logger.warn('No IPs found on Yandex page, page structure may have changed');
		}

		return ips;
	} catch (error) {
		logger.err(`Yandex IP extraction failed: ${error.message}`);
		return [];
	} finally {
		if (browser) {
			try {
				await browser.close();
			} catch (closeError) {
				logger.warn(`Failed to close browser: ${closeError.message}`);
			}
		}
	}
};

module.exports = getYandexIPs;

if (require.main === module) getYandexIPs().then(console.log).catch(console.error);