const { NetworkError, TimeoutError } = require('./errors.js');
const logger = require('./logger.js');

const RETRYABLE_ERROR_CODES = new Set([
	'ECONNRESET',
	'ETIMEDOUT',
	'ECONNABORTED',
	'ECONNREFUSED',
	'EAI_AGAIN',
	'ENETUNREACH',
	'EHOSTUNREACH',
	'EPIPE',
]);

const isRetryableError = err => {
	if (err instanceof NetworkError || err instanceof TimeoutError) return true;
	if (err?.response?.status >= 500 && err.response.status < 600) return true;
	return Boolean(err?.code) && RETRYABLE_ERROR_CODES.has(err.code);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const executeWithRetry = async (operation, {
	retries = 2,
	delay = 1000,
	backoff = 2,
	label = 'operation',
	retryPredicate = isRetryableError,
} = {}) => {
	let attempt = 0;
	while (attempt <= retries) {
		try {
			return await operation();
		} catch (err) {
			if (!retryPredicate(err) || attempt === retries) throw err;
			const waitMs = delay * Math.pow(backoff, attempt);
			logger.warn(`Retrying ${label} in ${waitMs}ms (attempt ${attempt + 1}/${retries + 1}): ${err.message}`);
			await sleep(waitMs);
			attempt++;
		}
	}
};

module.exports = {
	executeWithRetry,
	isRetryableError,
};
