const fs = require('node:fs/promises');
const path = require('node:path');
const ipaddr = require('ipaddr.js');
const { parse } = require('csv-parse/sync');

const listsDir = path.join(__dirname, '../lists');

const validateIP = ip => {
	ip.includes('/') ? ipaddr.parseCIDR(ip) : ipaddr.parse(ip);
};

const parseTxt = txt => {
	const lines = txt.trim().split('\n');
	expect(lines.length).toBeGreaterThan(0);
	lines.forEach(ip => validateIP(ip));
	return lines;
};

const parseCsv = csv => {
	const records = parse(csv, { columns: true, skip_empty_lines: true });
	expect(records.length).toBeGreaterThan(0);
	return records.map(r => {
		expect(r).toMatchObject({ IP: expect.any(String), Name: expect.any(String), Source: expect.any(String) });
		validateIP(r.IP);
		return r.IP;
	});
};

const parseJson = (json, global = false) => {
	const records = JSON.parse(json);
	expect(Array.isArray(records)).toBe(true);
	expect(records.length).toBeGreaterThan(0);
	return records.map(r => {
		if (global) {
			expect(r).toMatchObject({ IP: expect.any(String), Name: expect.any(String), Source: expect.any(String) });
			validateIP(r.IP);
			return r.IP;
		}
		expect(r).toMatchObject({ ip: expect.any(String), name: expect.any(String), source: expect.any(String) });
		validateIP(r.ip);
		return r.ip;
	});
};

describe('Generated bot IP lists', () => {
	it('validates bot folders and global merged list', async () => {
		const folders = (await fs.readdir(listsDir, { withFileTypes: true }))
			.filter(e => e.isDirectory() && !e.name.startsWith('all-'))
			.map(e => e.name);

		const allIPs = new Set();

		for (const folder of folders) {
			const base = path.join(listsDir, folder);
			const [txt, csv, json] = await Promise.all([
				fs.readFile(path.join(base, 'ips.txt'), 'utf8'),
				fs.readFile(path.join(base, 'ips.csv'), 'utf8'),
				fs.readFile(path.join(base, 'ips.json'), 'utf8'),
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
		expect(txtIPs.length).toBe(new Set(txtIPs).size);
		txtIPs.forEach(ip => expect(allIPs.has(ip)).toBe(true));
	});
});
