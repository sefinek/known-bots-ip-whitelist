process.loadEnvFile();
const simpleGit = require('simple-git');
const git = simpleGit();
const { CronJob } = require('cron');
const { spawn } = require('node:child_process');
const { stringify } = require('csv-stringify/sync');
const fs = require('node:fs/promises');
const path = require('node:path');
const fetchSource = require('./scripts/fetchSource.js');
const ipUtils = require('./scripts/ipUtils.js');
const logger = require('./scripts/utils/logger.js');
const { validateCommandArgs } = require('./scripts/utils/validation.js');

const isDevelopment = process.env.NODE_ENV === 'development';

const sources = [
	{ name: 'AhrefsBot', dir: 'ahrefsbot', url: 'https://api.ahrefs.com/v3/public/crawler-ips', type: 'jsonIps' },
	{ name: 'BetterStack', dir: 'betterstack', url: 'https://uptime.betterstack.com/ips.txt', type: 'hosts' },
	{ name: 'BingBot', dir: 'bingbot', url: 'https://www.bing.com/toolbox/bingbot.json', type: 'jsonPrefixes' },
	{ name: 'Bunny CDN', dir: 'bunnycdn', url: ['https://api.bunny.net/system/edgeserverlist/plain', 'https://api.bunny.net/system/edgeserverlist/ipv6'], type: 'textMulti' },
	{ name: 'Censys', dir: 'censys', keywords: ['censys', 'censy'], analyzeKeywords: true, acceptNullable: true, asn: 'AS398324', type: 'whois' },
	{ name: 'Cloudflare', dir: 'cloudflare', url: ['https://www.cloudflare.com/ips-v4', 'https://www.cloudflare.com/ips-v6'], type: 'textMulti' },
	{ name: 'DuckDuckBot', dir: 'duckduckbot', url: 'https://raw.githubusercontent.com/duckduckgo/duckduckgo-help-pages/master/_docs/results/duckduckbot.md', type: 'mdList' },
	{ name: 'FacebookBot', dir: 'facebookbot', keywords: ['meta', 'fb', 'facebook'], analyzeKeywords: true, acceptNullable: true, asn: 'AS32934', type: 'whois' },
	{ name: 'Google Special Crawlers', dir: 'google-special-crawlers', url: 'https://developers.google.com/search/apis/ipranges/special-crawlers.json', type: 'jsonPrefixes' },
	{ name: 'GoogleBot', dir: 'googlebot', url: 'https://developers.google.com/static/search/apis/ipranges/googlebot.json', type: 'jsonPrefixes' },
	{ name: 'Modat Scanner', dir: 'modat', file: 'modat.txt', type: 'file' },
	{ name: 'OpenAI', dir: 'openai', url: 'https://raw.githubusercontent.com/FabrizioCafolla/openai-crawlers-ip-ranges/main/openai/openai-ip-ranges-all.txt', type: 'hosts' },
	{ name: 'Palo Alto Networks', dir: 'paloaltonetworks', file: 'palo-alto-networks.txt', type: 'file' },
	{ name: 'PingdomBot', dir: 'pingdombot', url: ['https://my.pingdom.com/probes/ipv4', 'https://my.pingdom.com/probes/ipv6'], type: 'textMulti' },
	{ name: 'RSS API', dir: 'rssapi', url: 'https://rssapi.net/ips.txt', type: 'hosts' },
	{ name: 'Semrush', dir: 'semrush', analyzeKeywords: false, asn: ['AS398324', 'AS209366'], type: 'whois' },
	{ name: 'Shodan', dir: 'shodan', file: 'shodan.txt', type: 'file' },
	{ name: 'Stripe', dir: 'stripewebhook', url: 'https://stripe.com/files/ips/ips_webhooks.txt', type: 'hosts' },
	{ name: 'TelegramBot', dir: 'telegrambot', url: 'https://core.telegram.org/resources/cidr.txt', type: 'hosts' },
	{ name: 'UptimeRobot', dir: 'uptimerobot', url: 'https://uptimerobot.com/inc/files/ips/IPv4andIPv6.txt', type: 'hosts' },
	{ name: 'WebPageTest Bot', dir: 'webpagetestbot', url: 'https://www.webpagetest.org/addresses.php?f=json', type: 'jsonAddresses' },
	{ name: 'YandexBot', dir: 'yandexbot', type: 'yandex' },
];

const runTests = () => {
	logger.info('Running tests...');

	return new Promise((resolve, reject) => {
		const args = ['npm', 'run', 'test'];
		validateCommandArgs(args);

		const child = spawn(args[0], args.slice(1), {
			shell: true,
			stdio: ['inherit', 'pipe', 'pipe'],
			timeout: 300000,
		});

		let stderr = '', stdout = '';

		child.stdout.on('data', chunk => stdout += chunk);
		child.stderr.on('data', chunk => stderr += chunk);

		child.on('exit', code => {
			const fail = code !== 0 || stdout.includes('FAIL') || stderr.includes('FAIL');
			if (fail) {
				logger.err(`Tests failed with exit code ${code}`);
				if (stdout.trim()) console.log(stdout.trim());
				if (stderr.trim()) console.error(stderr.trim());
				reject(new Error(`Tests failed with exit code ${code}`));
			} else {
				logger.info('Tests passed successfully');
				resolve();
			}
		});

		child.on('error', err => {
			logger.err(`Test execution error: ${err.message}`);
			reject(err);
		});
	});
};


const pullLatestChanges = async () => {
	logger.info('Pulling latest changes');
	await git.pull('origin', 'main');
};

const setupDirectories = async () => {
	const base = path.join(__dirname, 'lists');
	await fs.mkdir(base, { recursive: true });
	return base;
};

const processAllSources = async (base) => {
	const allMap = new Map();
	const concurrencyLimit = 8;

	const processSources = async (sourceBatch) => {
		return await Promise.allSettled(
			sourceBatch.map(async (src) => {
				try {
					const records = await fetchSource(src);
					if (!Array.isArray(records) || !records.length) {
						logger.warn(`No records found for ${src.name}`);
						return { name: src.name, count: 0, records: [] };
					}

					const sortedRecords = records.sort((a, b) => ipUtils.compareIPs(a.ip, b.ip));
					const dir = path.join(base, src.dir);
					await fs.mkdir(dir, { recursive: true });

					const ips = sortedRecords.map(r => r.ip);
					const csvData = sortedRecords.map(r => ({ IP: r.ip, Name: src.name, Source: r.source }));
					const jsonData = sortedRecords.map(r => ({ ip: r.ip, name: src.dir, source: r.source }));

					await Promise.all([
						fs.writeFile(path.join(dir, 'ips.txt'), ips.join('\n'), 'utf8'),
						fs.writeFile(path.join(dir, 'ips.csv'), stringify(csvData, { header: true, columns: ['IP', 'Name', 'Source'] }), 'utf8'),
						fs.writeFile(path.join(dir, 'ips.json'), JSON.stringify(jsonData, null, 2), 'utf8'),
					]);

					logger.info(`${src.name}: ${sortedRecords.length} IPs`);
					return { name: src.name, count: sortedRecords.length, records: sortedRecords };
				} catch (err) {
					logger.err(`Failed to process ${src.name}: ${err.message}`);
					throw err;
				}
			})
		);
	};

	const batches = [];
	for (let i = 0; i < sources.length; i += concurrencyLimit) {
		batches.push(sources.slice(i, i + concurrencyLimit));
	}

	for (const batch of batches) {
		const results = await processSources(batch);
		for (const result of results) {
			if (result.status === 'fulfilled' && result.value.records) {
				for (const r of result.value.records) {
					if (!allMap.has(r.ip)) {
						allMap.set(r.ip, { Name: result.value.name, Source: r.source });
					}
				}
			}
		}
	}

	return allMap;
};

const createGlobalLists = async (base, allMap) => {
	logger.info('Writing global lists...');

	const globalIPs = Array.from(allMap.keys()).sort(ipUtils.compareIPs);
	const globalRecs = globalIPs.map(IP => ({ IP, ...allMap.get(IP) }));

	await Promise.all([
		fs.writeFile(path.join(base, 'all-safe-ips.txt'), globalIPs.join('\n'), 'utf8'),
		fs.writeFile(path.join(base, 'all-safe-ips.json'), JSON.stringify(globalRecs, null, 2), 'utf8'),
		fs.writeFile(path.join(base, 'all-safe-ips.csv'), stringify(globalRecs, { header: true, columns: ['IP', 'Name', 'Source'] }), 'utf8'),
	]);

	return globalRecs;
};

const commitAndPushChanges = async () => {
	const status = await git.status(['lists']);
	if (status.files.length > 0) {
		await runTests();

		logger.info(`Committing & pushing ${status.files.length} changed files...`);
		const timestamp = new Date().toUTCString();
		await git.add('./lists');
		await git.commit(
			`Auto-update IP lists (${status.files.length} modified files) - ${timestamp}`,
			{ '--author': `"Sefinek Actions <${process.env.GITHUB_EMAIL}>"` }
		);
		await git.push('origin', 'main');

		logger.info('Changes committed and pushed successfully');
	} else {
		logger.info('No changes detected, skipping commit');
	}
};

const generateLists = async () => {
	try {
		logger.info('Starting IP list generation');
		await pullLatestChanges();
		const base = await setupDirectories();
		const allMap = await processAllSources(base);
		const globalRecs = await createGlobalLists(base, allMap);
		logger.info(`Generation complete: ${globalRecs.length} IPs total`);

		if (isDevelopment) return;

		await commitAndPushChanges();

	} catch (err) {
		logger.err(`Failed to generate lists: ${err.message}`);
		throw err;
	}
};

const addGracefulShutdown = () => {
	const gracefulShutdown = async signal => {
		logger.info(`Received ${signal}, shutting down gracefully`);
		process.exit(0);
	};

	process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
	process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

if (isDevelopment) {
	addGracefulShutdown();
	generateLists()
		.then(() => {
			process.exit(0);
		})
		.catch(err => {
			logger.err(`Development run failed: ${err.message}`);
			process.exit(1);
		});
} else {
	addGracefulShutdown();

	new CronJob('0 */7 * * *', async () => {
		try {
			await generateLists();
		} catch (err) {
			logger.err('Cron job failed', { err: err.message });
		}
	}, null, true, 'utc');

	logger.info('Production mode: Cron job scheduled for every 5 hours');

	process.on('unhandledRejection', (reason, promise) => {
		logger.err('Unhandled Rejection', { reason, promise });
	});

	process.on('uncaughtException', err => {
		logger.err('Uncaught Exception', { err: err.message, stack: err.stack });
		process.exit(1);
	});

	process.send?.('ready');
}