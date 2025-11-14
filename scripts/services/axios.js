const axios = require('axios');
const { version } = require('../../package.json');
const logger = require('../utils/logger.js');

const api = axios.create({
	timeout: 60000,
	headers: {
		'User-Agent': `Mozilla/5.0 (compatible; KnownBotsIPWhitelist/${version}; +https://github.com/sefinek/known-bots-ip-whitelist)`,
		'Accept': 'application/json',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	},
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetry = (error, attempt, maxRetries) => {
	if (attempt >= maxRetries) return false;

	// Retry on network errors
	if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
		return true;
	}

	// Retry on 5xx server errors (but not 429 - that's handled separately)
	return error.response && error.response.status >= 500 && error.response.status < 600;
};

const getWithRetry = async (url, config = {}, attempt = 0) => {
	const maxRetries = 3;

	try {
		return await api.get(url, config);
	} catch (error) {
		if (shouldRetry(error, attempt, maxRetries)) {
			const backoffDelay = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s
			logger.warn(`HTTP request failed for ${url}, retrying in ${backoffDelay / 1000}s (attempt ${attempt + 1}/${maxRetries}): ${error.message}`);
			await sleep(backoffDelay);
			return getWithRetry(url, config, attempt + 1);
		}

		throw error;
	}
};

module.exports = { ...api, get: getWithRetry };