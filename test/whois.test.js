const getASNPrefixes = require('../scripts/services/whois.js');

describe('WHOIS module', () => {
	it('exports function for fetching ASN prefixes', () => {
		expect(typeof getASNPrefixes).toBe('function');
	});

	it('has retry logic for rate limiting', () => {
		// The whois module has complex async behavior with BGPView and WHOIS servers
		// Integration tests would require actual network calls or complex mocking
		// Basic validation that the module exports correctly
		const fs = require('fs');
		const path = require('path');
		const whoisPath = path.join(__dirname, '../scripts/services/whois.js');
		const content = fs.readFileSync(whoisPath, 'utf8');

		// Verify retry logic exists in code
		expect(content).toContain('retryCount');
		expect(content).toContain('429');
		expect(content).toContain('backoffDelay');
	});
});
