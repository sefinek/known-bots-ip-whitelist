const { describe, it, expect } = require('@jest/globals');
const fs = require('node:fs/promises');
const path = require('node:path');
const ipaddr = require('ipaddr.js');
const { parse } = require('csv-parse/sync');
const sourcesConfig = require('../sources.json');
const listsDir = path.join(__dirname, '../lists');

const validateIP = ip => {
	if (!ip || typeof ip !== 'string') throw new Error(`Invalid IP: ${ip}`);

	try {
		ip.includes('/') ? ipaddr.parseCIDR(ip) : ipaddr.parse(ip);
	} catch (err) {
		throw new Error(`${ip} - ${err.message}`, { cause: err });
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
		expect(r).toMatchObject({ IP: expect.any(String), Name: expect.any(String), Sources: expect.any(String) });
		validateIP(r.IP);
		return r.IP;
	});
};

const parseJson = raw => {
	const records = JSON.parse(raw);
	expect(Array.isArray(records)).toBe(true);
	expect(records.length).toBeGreaterThan(0);
	return records.map(r => {
		const ip = r.ip;
		const keys = { ip: expect.any(String), name: expect.any(String), sources: expect.any(Array) };
		expect(r).toMatchObject(keys);
		validateIP(ip);
		return ip;
	});
};

const validateListFiles = async (dir, label) => {
	const [txt, csv, json] = await Promise.all([
		fs.readFile(path.join(dir, 'ips.txt'), 'utf8').catch(() => null),
		fs.readFile(path.join(dir, 'ips.csv'), 'utf8').catch(() => null),
		fs.readFile(path.join(dir, 'ips.json'), 'utf8').catch(() => null),
	]);

	if (!txt || !csv || !json) throw new Error(`Missing files in ${label}`);

	const txtIPs = parseTxt(txt);
	expect(parseCsv(csv)).toEqual(txtIPs);
	expect(parseJson(json)).toEqual(txtIPs);
	return txtIPs;
};

const validateCombinedFiles = async (basename) => {
	const [txt, csv, json] = await Promise.all([
		fs.readFile(path.join(listsDir, `${basename}.txt`), 'utf8'),
		fs.readFile(path.join(listsDir, `${basename}.csv`), 'utf8'),
		fs.readFile(path.join(listsDir, `${basename}.json`), 'utf8'),
	]);

	const txtIPs = parseTxt(txt);
	const csvIPs = parseCsv(csv);
	const jsonIPs = parseJson(json);

	expect(new Set(csvIPs)).toEqual(new Set(txtIPs));
	expect(new Set(jsonIPs)).toEqual(new Set(txtIPs));
	expect(new Set(txtIPs).size).toBe(txtIPs.length);
	return txtIPs;
};

describe('Generated bot IP lists', () => {
	it('validates bot folders and global merged list', async () => {
		const entries = await fs.readdir(listsDir, { withFileTypes: true });
		const folders = entries.filter(e => e.isDirectory() && !e.name.startsWith('all-')).map(e => e.name);
		const expectedDirs = new Set(sourcesConfig.map(src => src.dir));

		// no orphaned directories
		folders.forEach(dir => expect(expectedDirs).toContain(dir));

		const allIPs = new Set();

		for (const folder of folders) {
			const ips = await validateListFiles(path.join(listsDir, folder), folder);
			ips.forEach(ip => allIPs.add(ip));
		}

		// global list
		const globalIPs = await validateCombinedFiles('all-safe-ips');
		globalIPs.forEach(ip => expect(allIPs.has(ip)).toBe(true));

		// category lists
		const categories = [...new Set(sourcesConfig.map(s => s.category).filter(Boolean))];
		for (const category of categories) {
			const basename = `all-${category}-ips`;
			const exists = await fs.access(path.join(listsDir, `${basename}.txt`)).then(() => true).catch(() => false);
			if (!exists) continue;

			const catIPs = await validateCombinedFiles(basename);
			catIPs.forEach(ip => expect(allIPs.has(ip)).toBe(true));
		}
	}, 20000);
});
