const getASNPrefixes = require('../scripts/services/whois.js');

describe('WHOIS module', () => {
	it('exports function for fetching ASN prefixes', () => {
		expect(typeof getASNPrefixes).toBe('function');
	});

	it('has retry logic for rate limiting', () => {
		const fs = require('fs');
		const path = require('path');
		const whoisPath = path.join(__dirname, '../scripts/services/whois.js');
		const content = fs.readFileSync(whoisPath, 'utf8');

		expect(content).toContain('retryCount');
		expect(content).toContain('429');
		expect(content).toContain('backoffDelay');
	});
});
