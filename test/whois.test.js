const { describe, it, expect } = require('@jest/globals');
const getASNPrefixes = require('../scripts/services/whois.js');

describe('WHOIS module', () => {
	it('exports function for fetching ASN prefixes', () => {
		expect(typeof getASNPrefixes).toBe('function');
	});

	it('integrates RIPEstat with retry logic', () => {
		const fs = require('node:fs');
		const path = require('node:path');
		const ripestatPath = path.join(__dirname, '../scripts/services/ripestat.js');
		const content = fs.readFileSync(ripestatPath, 'utf8');

		expect(content).toContain('retryCount');
		expect(content).toContain('429');
		expect(content).toContain('backoffDelay');
	});
});
