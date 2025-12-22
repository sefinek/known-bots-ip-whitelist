process.loadEnvFile();
const simpleGit = require('simple-git');
const git = simpleGit();
const { CronJob } = require('cron');
const { spawn } = require('node:child_process');
const { stringify } = require('csv-stringify/sync');
const fs = require('node:fs/promises');
const path = require('node:path');
const { hrtime } = require('node:process');
const sourcesConfig = require('./sources.json');
const fetchSource = require('./scripts/fetchSource.js');
const ipUtils = require('./scripts/ipUtils.js');
const RateLimiter = require('./scripts/utils/rateLimiter.js');
const logger = require('./scripts/utils/logger.js');
const { validateCommandArgs, validateSourcesConfig } = require('./scripts/utils/validation.js');

const isDevelopment = process.env.NODE_ENV === 'development';
const sources = validateSourcesConfig(sourcesConfig);

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
		const args = ['npm', 'test'];
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
	const concurrency = Math.max(1, Number(process.env.SOURCE_CONCURRENCY) || 3);
	const delayMs = Math.max(0, Number(process.env.SOURCE_DELAY_MS) || 500);
	const limiter = new RateLimiter(concurrency, delayMs);

	const handleSource = async src => {
		const sourceTimer = startTimer();
		try {
			logger.info(`Processing ${src.name}...`);
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
				const sourcesArray = Array.isArray(r.sources) ? r.sources : [r.source];
				const sourcesStr = sourcesArray.join('|');

				ips.push(r.ip);
				csvData.push({ IP: r.ip, Name: src.name, Sources: sourcesStr });
				jsonData.push({ ip: r.ip, name: src.dir, sources: sourcesArray });

				const entry = allMap.get(r.ip) || { names: new Set(), sources: new Set() };
				entry.names.add(src.name);
				sourcesArray.forEach(s => entry.sources.add(s));
				allMap.set(r.ip, entry);
			}

			await Promise.all([
				fs.writeFile(path.join(dir, 'ips.txt'), ips.join('\n'), 'utf8'),
				fs.writeFile(path.join(dir, 'ips.csv'), stringify(csvData, { header: true, columns: ['IP', 'Name', 'Sources'] }), 'utf8'),
				fs.writeFile(path.join(dir, 'ips.json'), JSON.stringify(jsonData, null, 2), 'utf8'),
			]);

			logger.success(`${src.name}: ${sortedRecords.length} IPs in ${formatDuration(getDurationMs(sourceTimer))}`);
		} catch (err) {
			logger.err(`Failed to process ${src.name} after ${formatDuration(getDurationMs(sourceTimer))}: ${err.message}`);
		}
	};

	await Promise.all(sources.map(src => limiter.execute(() => handleSource(src))));
	return allMap;
};

const createGlobalLists = async (base, allMap) => {
	logger.info('Writing global lists...');

	const globalIPs = Array.from(allMap.keys()).sort(ipUtils.compareIPs);
	const globalRecs = globalIPs.map(IP => {
		const entry = allMap.get(IP);
		const nameList = Array.from(entry.names).sort();
		const sourceList = Array.from(entry.sources).sort();

		return {
			IP,
			Name: nameList.join('|'),
			Names: nameList,
			Sources: sourceList.join('|'),
			SourcesList: sourceList,
		};
	});

	await Promise.all([
		fs.writeFile(path.join(base, 'all-safe-ips.txt'), globalIPs.join('\n'), 'utf8'),
		fs.writeFile(path.join(base, 'all-safe-ips.json'), JSON.stringify(globalRecs, null, 2), 'utf8'),
		fs.writeFile(path.join(base, 'all-safe-ips.csv'), stringify(globalRecs, { header: true, columns: ['IP', 'Name', 'Sources'] }), 'utf8'),
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

		logger.success('Changes committed and pushed successfully');
	} else {
		logger.info('No changes detected, skipping commit');
	}
};

const generateLists = async () => {
	const totalTimer = startTimer();
	try {
		logger.info('Starting IP list generation');
		await pullLatestChanges();
		const base = await setupDirectories();
		const allMap = await processAllSources(base);
		const globalRecs = await createGlobalLists(base, allMap);
		logger.success(`Generation complete: ${globalRecs.length} IPs total in ${formatDuration(getDurationMs(totalTimer))}`);

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

	new CronJob('0 */6 * * *', async () => {
		try {
			await generateLists();
		} catch (err) {
			logger.err('Cron job failed', { err: err.message });
		}
	}, null, true, 'utc');

	logger.info('Production mode: Cron job scheduled for every 6 hours');

	process.on('unhandledRejection', (reason, promise) => {
		logger.err('Unhandled Rejection', { reason, promise });
	});

	process.on('uncaughtException', err => {
		logger.err('Uncaught Exception', { err: err.message, stack: err.stack });
		process.exit(1);
	});

	process.send?.('ready');
}
