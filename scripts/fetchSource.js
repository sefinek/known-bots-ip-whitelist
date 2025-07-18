const fs = require('node:fs/promises');
const path = require('node:path');
const getYandexIPs = require('./parser/yandex.js');
const getASNPrefixes = require('./services/whois.js');
const axios = require('./services/axios.js');

const splitAndFilter = data =>
	data
		.split(/\r?\n/)
		.map(l => l.trim())
		.filter(l => l && !l.startsWith('#'));

const parseList = (list, source) =>
	list.map(ip => ({ ip, source }));

module.exports = async src => {
	let out = [];

	try {
		switch (src.type) {
		case 'whois':
			if (!src.asn) throw new Error(`Missing ASN for ${src.name}`);
			out = await getASNPrefixes(src);
			break;
		case 'yandex':
			out = await getYandexIPs();
			break;
		case 'file': {
			if (!src.file) throw new Error(`Missing file for ${src.name}`);
			const filePath = path.join(__dirname, '../custom', src.file);
			const data = await fs.readFile(filePath, 'utf8');
			const sourceUrl = `https://github.com/sefinek/known-bots-ip-whitelist/blob/main/custom/${src.file}`;
			out = parseList(splitAndFilter(data), sourceUrl);
			break;
		}
		case 'hosts': {
			const data = await axios.get(src.url).then(r => r.data);
			out = parseList(splitAndFilter(data), src.url);
			break;
		}
		case 'textMulti': {
			const results = await Promise.all(src.url.map(async u => {
				const d = await axios.get(u).then(r => r.data);
				if (typeof d === 'string') return parseList(splitAndFilter(d), u);
				if (Array.isArray(d)) return parseList(d.map(String).map(l => l.trim()).filter(Boolean), u);
				return [];
			}));
			out = results.flat();
			break;
		}
		case 'jsonPrefixes': {
			const data = await axios.get(src.url).then(r => r.data);
			out = parseList(
				(data.prefixes || []).map(p => p.ipv4Prefix || p.ipv6Prefix).filter(Boolean),
				src.url
			);
			break;
		}
		case 'jsonIps': {
			const data = await axios.get(src.url).then(r => r.data);
			out = parseList(
				(data.ips || []).map(o => o.ip_address).filter(Boolean),
				src.url
			);
			break;
		}
		case 'jsonAddresses': {
			const data = await axios.get(src.url).then(r => r.data);
			out = parseList(
				Object.values(data.data || {}).flatMap(d => d.addresses || []).filter(Boolean),
				src.url
			);
			break;
		}
		case 'mdList': {
			const data = await axios.get(src.url).then(r => r.data);
			out = parseList(
				data
					.split(/\r?\n/)
					.filter(l => l.startsWith('- '))
					.map(l => l.replace(/^- /, '').trim()),
				src.url
			);
			break;
		}
		default:
			break;
		}
	} catch (err) {
		console.error(`[${src.name}] ${err.stack}`);
	}

	out = Array.from(new Map(out.map(r => [`${r.ip}|${r.source}`, r])).values());

	console[out.length ? 'log' : 'warn'](`Collected ${out.length} IPs for ${src.name}`);

	return out;
};