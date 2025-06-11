const fs = require('node:fs/promises');
const path = require('node:path');
const ipaddr = require('ipaddr.js');
const { parse } = require('csv-parse/sync');
const listsDir = path.join(__dirname, '../lists');

const validateIP = ip => {
	if (!ip || typeof ip !== 'string') throw new Error(`Invalid IP: ${ip}`);

	try {
		ip.includes('/') ? ipaddr.parseCIDR(ip) : ipaddr.parse(ip);
	} catch (err) {
		throw new Error(`${ip} - ${err.message}`);
	}
};

const parseTxt = raw => {
	const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
	expect(lines.length).toBeGreaterThan(0);
	lines.forEach(validateIP);
	return lines;
};

const parseCsv = raw => {
	const records = parse(raw, { columns: true, skip_empty_lines: true });
	expect(records.length).toBeGreaterThan(0);
	return records.map(r => {
		expect(r).toMatchObject({ IP: expect.any(String), Name: expect.any(String), Source: expect.any(String) });
		validateIP(r.IP);
		return r.IP;
	});
};

const parseJson = (raw, global = false) => {
	const records = JSON.parse(raw);
	expect(Array.isArray(records)).toBe(true);
	expect(records.length).toBeGreaterThan(0);
	return records.map(r => {
		const ip = global ? r.IP : r.ip;
		const keys = global
			? { IP: expect.any(String), Name: expect.any(String), Source: expect.any(String) }
			: { ip: expect.any(String), name: expect.any(String), source: expect.any(String) };
		expect(r).toMatchObject(keys);
		validateIP(ip);
		return ip;
	});
};

describe('Generated bot IP lists', () => {
	it('validates bot folders and global merged list', async () => {
		const entries = await fs.readdir(listsDir, { withFileTypes: true });
		const folders = entries.filter(e => e.isDirectory() && !e.name.startsWith('all-')).map(e => e.name);
		const allIPs = new Set();

		for (const folder of folders) {
			const dir = path.join(listsDir, folder);
			const [txt, csv, json] = await Promise.all([
				fs.readFile(path.join(dir, 'ips.txt'), 'utf8'),
				fs.readFile(path.join(dir, 'ips.csv'), 'utf8'),
				fs.readFile(path.join(dir, 'ips.json'), 'utf8'),
			]);

			const txtIPs = parseTxt(txt);
			expect(parseCsv(csv)).toEqual(txtIPs);
			expect(parseJson(json)).toEqual(txtIPs);
			txtIPs.forEach(ip => allIPs.add(ip));
		}

		const [txt, csv, json] = await Promise.all([
			fs.readFile(path.join(listsDir, 'all-safe-ips.txt'), 'utf8'),
			fs.readFile(path.join(listsDir, 'all-safe-ips.csv'), 'utf8'),
			fs.readFile(path.join(listsDir, 'all-safe-ips.json'), 'utf8'),
		]);

		const txtIPs = parseTxt(txt);
		const csvIPs = parseCsv(csv);
		const jsonIPs = parseJson(json, true);

		expect(new Set(csvIPs)).toEqual(new Set(txtIPs));
		expect(new Set(jsonIPs)).toEqual(new Set(txtIPs));
		expect(new Set(txtIPs).size).toBe(txtIPs.length);
		txtIPs.forEach(ip => expect(allIPs.has(ip)).toBe(true));
	});
});