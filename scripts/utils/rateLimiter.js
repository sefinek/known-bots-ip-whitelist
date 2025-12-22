const logger = require('./logger.js');

class RateLimiter {
	constructor(maxConcurrent = 3, delayMs = 1000) {
		if (maxConcurrent <= 0 || delayMs < 0) throw new Error('Invalid rate limiter configuration');
		this.maxConcurrent = maxConcurrent;
		this.delayMs = delayMs;
		this.running = 0;
		this.queue = [];
		this.stats = {
			total: 0,
			success: 0,
			failed: 0,
			queued: 0,
		};
	}

	async execute(fn) {
		if (typeof fn !== 'function') {
			throw new Error('Rate limiter expects a function');
		}

		this.stats.total++;
		this.stats.queued++;

		return new Promise((resolve, reject) => {
			this.queue.push({
				fn,
				resolve: (result) => {
					this.stats.success++;
					this.stats.queued--;
					resolve(result);
				},
				reject: (error) => {
					this.stats.failed++;
					this.stats.queued--;
					reject(error);
				},
			});
			this.processQueue();
		});
	}

	async processQueue() {
		if (this.running >= this.maxConcurrent || !this.queue.length) return;

		this.running++;
		const { fn, resolve, reject } = this.queue.shift();

		try {
			const result = await fn();
			resolve(result);
		} catch (err) {
			if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') await new Promise(r => setTimeout(r, this.delayMs * 2));
			reject(err);
		} finally {
			this.running--;
			setTimeout(() => this.processQueue(), this.delayMs);
		}
	}

	getStats() {
		return { ...this.stats, running: this.running, queued: this.queue.length };
	}
}

module.exports = RateLimiter;

if (require.main === module) {
	const limiter = new RateLimiter(2, 1000);
	logger.info('Rate limiter test started');

	Promise.all([
		limiter.execute(() => Promise.resolve('test1')),
		limiter.execute(() => Promise.resolve('test2')),
		limiter.execute(() => Promise.resolve('test3')),
	]).then(results => {
		logger.success(`Results: ${JSON.stringify(results)}`);
		logger.info(`Stats: ${JSON.stringify(limiter.getStats())}`);
	}).catch(err => logger.err(err));
}
