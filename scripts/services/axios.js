const axios = require('axios');
const https = require('node:https');
const tls = require('node:tls');
const { version } = require('../../package.json');
const RateLimiter = require('../utils/rateLimiter.js');

const api = axios.create({
	timeout: 60000,
	httpsAgent: new https.Agent({
		rejectUnauthorized: true,
		checkServerIdentity: tls.checkServerIdentity,
	}),
	headers: {
		'User-Agent': `Mozilla/5.0 (compatible; GoodBots-IP-Whitelist/${version}; +https://github.com/sefinek/known-bots-ip-whitelist)`,
		'Accept': 'application/json',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	},
});

const rateLimiter = new RateLimiter(3, 1000);

const rateLimitedGet = (url, config = {}) => {
	return rateLimiter.execute(() => api.get(url, config));
};

module.exports = { ...api, get: rateLimitedGet };