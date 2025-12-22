const { describe, it, expect } = require('@jest/globals');
const { compareIPs, parseIP } = require('../scripts/ipUtils.js');

describe('parseIP', () => {
	it('parses valid IPv4', () => {
		expect(parseIP('1.2.3.4').toString()).toBe('1.2.3.4');
	});

	it('parses valid IPv6', () => {
		expect(parseIP('2001:4860:4860::8888').toString()).toBe('2001:4860:4860::8888');
	});

	it('parses CIDR and returns base IP', () => {
		expect(parseIP('8.8.8.0/24').toString()).toBe('8.8.8.0');
	});

	it('returns null on invalid IP', () => {
		expect(parseIP('not-an-ip')).toBeNull();
	});
});

describe('compareIPs', () => {
	it('sorts IPv4 correctly', () => {
		const list = ['8.8.8.8', '1.1.1.1', '192.168.1.1'];
		const sorted = [...list].sort(compareIPs);
		expect(sorted).toEqual(['1.1.1.1', '8.8.8.8', '192.168.1.1']);
	});

	it('sorts mixed IPv4 and IPv6 correctly', () => {
		const list = ['2001:db8::1', '8.8.8.8', '::1'];
		const sorted = [...list].sort(compareIPs);
		expect(sorted).toEqual(['8.8.8.8', '::1', '2001:db8::1']);
	});
});