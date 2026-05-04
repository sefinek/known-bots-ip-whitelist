const { describe, it, expect } = require('@jest/globals');

describe('axios instance', () => {
	const api = require('../scripts/services/axios.js');

	it('exports a function with get method', () => {
		expect(typeof api.get).toBe('function');
	});

	it('has 60 second timeout', () => {
		expect(api.defaults.timeout).toBe(60000);
	});

	it('includes project User-Agent header', () => {
		const headers = api.defaults.headers;
		const ua = headers?.common?.['User-Agent'] ?? headers?.['User-Agent'];
		expect(ua).toMatch(/KnownIPsWhitelist/);
	});

	it('sets Accept to application/json', () => {
		const headers = api.defaults.headers;
		const accept = headers?.common?.Accept ?? headers?.Accept;
		expect(accept).toContain('application/json');
	});
});
