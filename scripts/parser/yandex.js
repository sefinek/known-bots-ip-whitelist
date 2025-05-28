const axios = require('../services/axios.js');
const cheerio = require('cheerio');

(async () => {
	const { data } = await axios.get('https://yandex.com/ips');
	const $ = cheerio.load(data);
	const ips = [];

	$('span').each((_, el) => {
		const text = $(el).text().trim();
		console.log(text);
		if (text.match(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/) || text.match(/^([a-fA-F0-9:]+)\/\d{1,3}$/)) {
			ips.push(text);
		}
	});

	console.log(ips);
})();
