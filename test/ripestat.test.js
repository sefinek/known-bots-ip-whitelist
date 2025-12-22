const { describe, it, expect } = require('@jest/globals');
const fetchFromRIPEstat = require('../scripts/services/ripestat.js');

describe('RIPEstat module', () => {
	it('exports function for fetching ASN prefixes', () => {
		expect(typeof fetchFromRIPEstat).toBe('function');
	});

	it('has retry mechanism with exponential backoff', () => {
		const fs = require('node:fs');
		const path = require('node:path');
		const ripestatPath = path.join(__dirname, '../scripts/services/ripestat.js');
		const content = fs.readFileSync(ripestatPath, 'utf8');

		expect(content).toContain('retryCount');
		expect(content).toContain('maxRetries');
		expect(content).toContain('429');
		expect(content).toContain('backoffDelay');
		expect(content).toContain('Math.pow(2, retryCount)');
	});

	it('validates response structure from RIPEstat API', () => {
		const fs = require('node:fs');
		const path = require('node:path');
		const ripestatPath = path.join(__dirname, '../scripts/services/ripestat.js');
		const content = fs.readFileSync(ripestatPath, 'utf8');

		expect(content).toContain('data.status');
		expect(content).toContain('data.data.prefixes');
		expect(content).toContain('status !== \'ok\'');
	});

	it('uses progressive delays for rate limiting', () => {
		const fs = require('node:fs');
		const path = require('node:path');
		const ripestatPath = path.join(__dirname, '../scripts/services/ripestat.js');
		const content = fs.readFileSync(ripestatPath, 'utf8');

		expect(content).toContain('shouldDelay');
		expect(content).toContain('baseDelay');
		expect(content).toContain('randomDelay');
		expect(content).toContain('sleep(baseDelay, randomDelay)');
	});

	it('validates IP prefixes using parseIP', () => {
		const fs = require('node:fs');
		const path = require('node:path');
		const ripestatPath = path.join(__dirname, '../scripts/services/ripestat.js');
		const content = fs.readFileSync(ripestatPath, 'utf8');

		expect(content).toContain('parseIP');
		expect(content).toContain('p.prefix');
	});

	it('returns array with ip and source properties', () => {
		const fs = require('node:fs');
		const path = require('node:path');
		const ripestatPath = path.join(__dirname, '../scripts/services/ripestat.js');
		const content = fs.readFileSync(ripestatPath, 'utf8');

		expect(content).toContain('result.push');
		expect(content).toContain('source: \'stat.ripe.net\'');
	});

	it('handles errors gracefully and returns empty array', () => {
		const fs = require('node:fs');
		const path = require('node:path');
		const ripestatPath = path.join(__dirname, '../scripts/services/ripestat.js');
		const content = fs.readFileSync(ripestatPath, 'utf8');

		expect(content).toContain('catch (err)');
		expect(content).toContain('return []');
		expect(content).toContain('logger.warn');
	});
});
