process.loadEnvFile();
const simpleGit = require('simple-git');
const git = simpleGit();
const { CronJob } = require('cron');
const { spawn } = require('node:child_process');
const { stringify } = require('csv-stringify/sync');
const fs = require('node:fs/promises');
const path = require('node:path');
const { hrtime } = require('node:process');
const fetchSource = require('./scripts/fetchSource.js');
const ipUtils = require('./scripts/ipUtils.js');
const RateLimiter = require('./scripts/utils/rateLimiter.js');
const logger = require('./scripts/utils/logger.js');
const { validateSourcesConfig } = require('./scripts/utils/validation.js');

const isDevelopment = process.env.NODE_ENV === 'development';

const loadSourcesConfig = async () => {
	const filePath = path.join(__dirname, 'sources.json');
	const raw = await fs.readFile(filePath, 'utf8');
	const parsed = JSON.parse(raw);
	return validateSourcesConfig(parsed);
};

const startTimer = () => hrtime.bigint();
const getDurationMs = start => Number(hrtime.bigint() - start) / 1e6;
const formatDuration = ms => {
	if (ms >= 3600000) return `${(ms / 3600000).toFixed(2)}h`;
	if (ms >= 60000) return `${(ms / 60000).toFixed(2)}m`;
	if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
	return `${ms.toFixed(0)}ms`;
};

const runTests = () => {
	logger.info('Running tests...');

	return new Promise((resolve, reject) => {
		const child = spawn('npm test', [], {
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
				if (stdout.trim()) logger.info(stdout.trim());
				if (stderr.trim()) logger.err(stderr.trim());
				reject(new Error(`Tests failed with exit code ${code}`));
			} else {
				logger.success('Tests passed successfully');
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
	logger.info('Pulling latest changes...');
	await git.pull('origin', 'main');
};

const setupDirectories = async () => {
	const base = path.join(__dirname, 'lists');
	await fs.mkdir(base, { recursive: true });
	return base;
};

const processAllSources = async (base, sources) => {
	const allMap = new Map();
	const categoryMaps = new Map();
	const concurrency = Math.max(1, Number(process.env.SOURCE_CONCURRENCY) || 3);
	const delayMs = Math.max(0, Number(process.env.SOURCE_DELAY_MS) || 500);
	const limiter = new RateLimiter(concurrency, delayMs);

	const handleSource = async src => {
		const sourceTimer = startTimer();
		try {
			logger.debug(`Processing ${src.name}...`);
			const records = await fetchSource(src);

			if (!Array.isArray(records) || !records.length) {
				logger.warn(`No records found for ${src.name}, skipping file write`);
				return;
			}

			const filteredRecords = records.filter(r => {
				if (!r?.ip) return false;
				if (ipUtils.isPrivateIP(r.ip)) {
					logger.warn(`Skipping private IP ${r.ip} from ${src.name}`);
					return false;
				}
				return true;
			});

			if (!filteredRecords.length) {
				logger.warn(`No non-private records for ${src.name}, skipping file write`);
				return;
			}

			const sortedRecords = filteredRecords.sort((a, b) => ipUtils.compareIPs(a.ip, b.ip));
			const dir = path.join(base, src.dir);
			await fs.mkdir(dir, { recursive: true });

			const ips = [];
			const csvData = [];
			const jsonData = [];

			for (const r of sortedRecords) {
				const sourcesArray = r.sources;
				const sourcesStr = sourcesArray.join('|');

				const displayName = r.label || src.name;
				ips.push(r.ip);
				csvData.push({ IP: r.ip, Name: displayName, Sources: sourcesStr });
				jsonData.push({ ip: r.ip, name: displayName, sources: sourcesArray });

				const addToMap = map => {
					const entry = map.get(r.ip) || { names: new Set(), sources: new Set() };
					entry.names.add(displayName);
					sourcesArray.forEach(s => entry.sources.add(s));
					map.set(r.ip, entry);
				};

				addToMap(allMap);

				if (src.category) {
					if (!categoryMaps.has(src.category)) categoryMaps.set(src.category, new Map());
					addToMap(categoryMaps.get(src.category));
				}
			}

			await Promise.all([
				fs.writeFile(path.join(dir, 'ips.txt'), ips.join('\n'), 'utf8'),
				fs.writeFile(path.join(dir, 'ips.csv'), stringify(csvData, { header: true, columns: ['IP', 'Name', 'Sources'] }), 'utf8'),
				fs.writeFile(path.join(dir, 'ips.json'), JSON.stringify(jsonData), 'utf8'),
			]);

			logger.success(`${src.name}: ${sortedRecords.length} IPs in ${formatDuration(getDurationMs(sourceTimer))}`);
		} catch (err) {
			logger.err(`Failed to process ${src.name} after ${formatDuration(getDurationMs(sourceTimer))}: ${err.message}`);
		}
	};

	await Promise.all(sources.map(src => limiter.execute(() => handleSource(src))));
	return { allMap, categoryMaps };
};

const buildRecords = (ipMap, logSkipped = false) => {
	const sortedIPs = Array.from(ipMap.keys()).sort(ipUtils.compareIPs);
	const parsedCIDRs = sortedIPs
		.filter(ip => ip.includes('/'))
		.map(ipUtils.parseCIDREntry)
		.filter(Boolean);

	return sortedIPs.flatMap(ip => {
		if (!ip.includes('/')) {
			const covering = ipUtils.findCoveringCIDR(ip, parsedCIDRs);
			if (covering) {
				if (logSkipped) {
					const entry = ipMap.get(ip);
					logger.info(`IP ${ip} (${Array.from(entry.names).sort().join('|')}) is already covered by CIDR ${covering.cidr}, skipping...`);
				}
				return [];
			}
		}

		const entry = ipMap.get(ip);
		const nameList = Array.from(entry.names).sort();
		if (logSkipped && nameList.length > 1) logger.warn(`IP ${ip} appears in multiple sources: ${nameList.join(', ')}`);
		return [{ ip, name: nameList.join('|'), sources: Array.from(entry.sources).sort() }];
	});
};

const writeListFiles = async (base, filename, recs) => {
	await Promise.all([
		fs.writeFile(path.join(base, `${filename}.txt`), recs.map(r => r.ip).join('\n'), 'utf8'),
		fs.writeFile(path.join(base, `${filename}.json`), JSON.stringify(recs), 'utf8'),
		fs.writeFile(path.join(base, `${filename}.csv`), stringify(
			recs.map(r => ({ IP: r.ip, Name: r.name, Sources: r.sources.join('|') })),
			{ header: true, columns: ['IP', 'Name', 'Sources'] }
		), 'utf8'),
	]);
};

const createCategoryLists = async (base, categoryMaps) => {
	logger.info('Writing category lists...');

	await Promise.all(Array.from(categoryMaps.keys()).map(async category => {
		const catMap = categoryMaps.get(category);
		if (!catMap || !catMap.size) return;

		const recs = buildRecords(catMap);
		await writeListFiles(base, `all-${category}-ips`, recs);
		logger.success(`Category ${category}: ${recs.length} IPs written`);
	}));
};

const createGlobalLists = async (base, allMap) => {
	logger.info('Writing global lists...');

	const globalRecs = buildRecords(allMap, true);
	await writeListFiles(base, 'all-safe-ips', globalRecs);
	return globalRecs;
};

const commitAndPushChanges = async () => {
	const status = await git.status(['lists']);
	if (status.files.length > 0) {
		await runTests();

		logger.info(`Committing & pushing ${status.files.length} changed files...`);

		const now = new Date();
		const pad = n => String(n).padStart(2, '0');
		const timestamp = `${pad(now.getUTCDate())}.${pad(now.getUTCMonth() + 1)}.${now.getUTCFullYear()}, ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
		await git.add('./lists');
		await git.commit(
			`Auto-update IP lists (${status.files.length} modified files) - ${timestamp}`,
			{ '--author': `"Sefinek Actions <${process.env.GITHUB_EMAIL}>"` }
		);
		await git.push('origin', 'main');

		logger.success('Changes committed and pushed successfully');
	} else {
		logger.info('No changes detected, skipping commit');
	}
};

const generateLists = async () => {
	await pullLatestChanges();
	const sources = await loadSourcesConfig();

	const totalTimer = startTimer();
	try {
		logger.info('Starting IP list generation...');

		const base = await setupDirectories();
		const { allMap, categoryMaps } = await processAllSources(base, sources);
		const [globalRecs] = await Promise.all([
			createGlobalLists(base, allMap),
			createCategoryLists(base, categoryMaps),
		]);

		const cidrCount = globalRecs.filter(r => r.ip.includes('/')).length;
		const ipCount = globalRecs.length - cidrCount;
		logger.success(`Generation complete: ${globalRecs.length} total (${ipCount} IPs, ${cidrCount} CIDRs) in ${formatDuration(getDurationMs(totalTimer))}`);

		if (!isDevelopment) await commitAndPushChanges();
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

	new CronJob('0 */6 * * *', async () => {
		try {
			await generateLists();
		} catch (err) {
			logger.err(`Cron job failed: ${err.message}`);
		}
	}, null, true, 'utc');

	logger.info('Production mode: Cron job scheduled for every 6 hours');

	process.on('unhandledRejection', reason => {
		const details = reason instanceof Error ? (reason.stack || reason.message) : JSON.stringify(reason);
		logger.err(`Unhandled Rejection: ${details}`);
	});

	process.on('uncaughtException', err => {
		logger.err(`Uncaught Exception: ${err.stack || err.message}`);
		process.exit(1);
	});

	process.send?.('ready');
}
