const { describe, it, expect } = require('@jest/globals');

describe('whois module', () => {
	const getASNPrefixes = require('../scripts/services/whois.js');

	it('exports a function', () => {
		expect(typeof getASNPrefixes).toBe('function');
	});
});
