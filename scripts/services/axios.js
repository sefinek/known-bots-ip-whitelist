const axios = require('axios');
const { version } = require('../../package.json');

const api = axios.create({
	timeout: 25000,
	headers: {
		'User-Agent': `Mozilla/5.0 (compatible; GoodBots-IP-Whitelist/${version}; +https://github.com/sefinek/GoodBots-IP-Whitelist)`,
		'Accept': 'application/json',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	},
});

module.exports = api;