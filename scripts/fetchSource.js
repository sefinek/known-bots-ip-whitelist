const getYandexIPs = require('./parser/yandex.js');
const getASNPrefixes = require('./services/radb.js');
const axios = require('./services/axios.js');

module.exports = async src => {
	let out = [];

	if (src.type === 'radb') {
		if (!src.asn) throw new Error(`Missing ASN for ${src.name}`);
		out = await getASNPrefixes(src.asn);
	} else if (src.type === 'yandex') {
		out = await getYandexIPs();
	} else {
		try {
			if (src.type === 'hosts') {
				const data = await axios.get(src.url).then(r => r.data);
				out = data
					.split(/\r?\n/)
					.map(l => l.trim())
					.filter(Boolean)
					.map(ip => ({ ip, source: src.url }));
			} else if (src.type === 'textMulti') {
				for (const u of src.url) {
					const d = await axios.get(u).then(r => r.data);
					if (typeof d === 'string') {
						d
							.split(/\r?\n/)
							.map(l => l.trim())
							.filter(Boolean)
							.forEach(ip => out.push({ ip, source: u }));
					} else if (Array.isArray(d)) {
						d
							.map(String)
							.map(l => l.trim())
							.filter(Boolean)
							.forEach(ip => out.push({ ip, source: u }));
					}
				}
			} else if (src.type === 'jsonPrefixes') {
				const data = await axios.get(src.url).then(r => r.data);
				(data.prefixes || [])
					.map(p => p.ipv4Prefix || p.ipv6Prefix)
					.filter(Boolean)
					.forEach(ip => out.push({ ip, source: src.url }));
			} else if (src.type === 'jsonIps') {
				const data = await axios.get(src.url).then(r => r.data);
				(data.ips || [])
					.map(o => o.ip_address)
					.filter(Boolean)
					.forEach(ip => out.push({ ip, source: src.url }));
			} else if (src.type === 'jsonAddresses') {
				const data = await axios.get(src.url).then(r => r.data);
				Object.values(data.data || {})
					.flatMap(d => d.addresses || [])
					.filter(Boolean)
					.forEach(ip => out.push({ ip, source: src.url }));
			} else if (src.type === 'mdList') {
				const data = await axios.get(src.url).then(r => r.data);
				data
					.split(/\r?\n/)
					.filter(l => l.startsWith('- '))
					.map(l => l.replace(/^- /, '').trim())
					.forEach(ip => out.push({ ip, source: src.url }));
			}
		} catch (err) {
			console.error(`Error fetching ${src.name}:`, err.stack);
		}
	}

	out = Array.from(new Map(out.map(r => [`${r.ip}|${r.source}`, r])).values());

	console.log(`Collected ${out.length} IPs for ${src.name}`);
	return out;
};
