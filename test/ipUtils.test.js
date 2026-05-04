const { describe, it, expect } = require('@jest/globals');
const { parseIP, isValidIP, compareIPs, isPrivateIP, parseCIDREntry, findCoveringCIDR } = require('../scripts/ipUtils.js');

describe('ipUtils', () => {
	describe('parseIP', () => {
		it('parses valid IPv4', () => {
			expect(parseIP('1.2.3.4').toString()).toBe('1.2.3.4');
		});

		it('parses valid IPv6', () => {
			expect(parseIP('2001:4860:4860::8888').toString()).toBe('2001:4860:4860::8888');
		});

		it('parses CIDR and returns base address', () => {
			expect(parseIP('8.8.8.0/24').toString()).toBe('8.8.8.0');
			expect(parseIP('2606:4700::/32').toString()).toBe('2606:4700::');
		});

		it('trims whitespace before parsing', () => {
			expect(parseIP('  1.1.1.1  ').toString()).toBe('1.1.1.1');
		});

		it('returns null for invalid input', () => {
			expect(parseIP('not-an-ip')).toBeNull();
			expect(parseIP('')).toBeNull();
			expect(parseIP(null)).toBeNull();
			expect(parseIP(undefined)).toBeNull();
			expect(parseIP(123)).toBeNull();
		});

		it('returns null for prefix out of range', () => {
			expect(parseIP('1.2.3.4/33')).toBeNull();
			expect(parseIP('::1/129')).toBeNull();
		});

		it('returns null for negative prefix', () => {
			expect(parseIP('1.2.3.4/-1')).toBeNull();
		});
	});

	describe('isValidIP', () => {
		it('accepts valid IPv4', () => {
			expect(isValidIP('8.8.8.8')).toBe(true);
		});

		it('accepts valid IPv6', () => {
			expect(isValidIP('2001:4860:4860::8844')).toBe(true);
		});

		it('accepts valid CIDR', () => {
			expect(isValidIP('10.0.0.0/8')).toBe(true);
			expect(isValidIP('2606:4700::/32')).toBe(true);
		});

		it('rejects invalid input', () => {
			expect(isValidIP('not-an-ip')).toBe(false);
			expect(isValidIP('')).toBe(false);
			expect(isValidIP(null)).toBe(false);
			expect(isValidIP(undefined)).toBe(false);
		});
	});

	describe('compareIPs', () => {
		it('sorts IPv4 addresses numerically', () => {
			const list = ['8.8.8.8', '1.1.1.1', '192.168.1.1'];
			expect([...list].sort(compareIPs)).toEqual(['1.1.1.1', '8.8.8.8', '192.168.1.1']);
		});

		it('sorts IPv6 addresses correctly', () => {
			const list = ['2001:db8::2', '2001:db8::1', '::1'];
			expect([...list].sort(compareIPs)).toEqual(['::1', '2001:db8::1', '2001:db8::2']);
		});

		it('places IPv4 before IPv6', () => {
			const list = ['2001:db8::1', '8.8.8.8', '::1'];
			const sorted = [...list].sort(compareIPs);
			expect(sorted[0]).toBe('8.8.8.8');
		});

		it('sorts CIDRs by prefix length when base is equal', () => {
			const list = ['10.0.0.0/16', '10.0.0.0/8', '10.0.0.0/24'];
			expect([...list].sort(compareIPs)).toEqual(['10.0.0.0/8', '10.0.0.0/16', '10.0.0.0/24']);
		});
	});

	describe('isPrivateIP', () => {
		it('detects RFC 1918 private ranges', () => {
			expect(isPrivateIP('10.0.0.1')).toBe(true);
			expect(isPrivateIP('172.16.0.1')).toBe(true);
			expect(isPrivateIP('172.31.255.255')).toBe(true);
			expect(isPrivateIP('192.168.1.1')).toBe(true);
		});

		it('detects loopback addresses', () => {
			expect(isPrivateIP('127.0.0.1')).toBe(true);
			expect(isPrivateIP('::1')).toBe(true);
		});

		it('detects link-local addresses', () => {
			expect(isPrivateIP('169.254.1.1')).toBe(true);
			expect(isPrivateIP('fe80::1')).toBe(true);
		});

		it('returns false for public IPs', () => {
			expect(isPrivateIP('8.8.8.8')).toBe(false);
			expect(isPrivateIP('1.1.1.1')).toBe(false);
			expect(isPrivateIP('2606:4700:4700::1111')).toBe(false);
		});

		it('returns false for invalid input', () => {
			expect(isPrivateIP('not-an-ip')).toBe(false);
			expect(isPrivateIP(null)).toBe(false);
		});
	});

	describe('parseCIDREntry', () => {
		it('parses valid IPv4 CIDR', () => {
			const result = parseCIDREntry('192.168.0.0/16');
			expect(result).not.toBeNull();
			expect(result.cidr).toBe('192.168.0.0/16');
			expect(result.prefix).toBe(16);
		});

		it('parses valid IPv6 CIDR', () => {
			const result = parseCIDREntry('2606:4700::/32');
			expect(result).not.toBeNull();
			expect(result.cidr).toBe('2606:4700::/32');
			expect(result.prefix).toBe(32);
		});

		it('returns null for invalid CIDR', () => {
			expect(parseCIDREntry('not-a-cidr')).toBeNull();
			expect(parseCIDREntry('1.2.3.4')).toBeNull();
		});
	});

	describe('findCoveringCIDR', () => {
		it('finds covering CIDR for an IP', () => {
			const cidrs = [parseCIDREntry('8.8.0.0/16')].filter(Boolean);
			expect(findCoveringCIDR('8.8.8.8', cidrs)).not.toBeNull();
			expect(findCoveringCIDR('8.8.8.8', cidrs).cidr).toBe('8.8.0.0/16');
		});

		it('returns null when no CIDR covers the IP', () => {
			const cidrs = [parseCIDREntry('10.0.0.0/8')].filter(Boolean);
			expect(findCoveringCIDR('8.8.8.8', cidrs)).toBeNull();
		});

		it('matches IPv6 IP against IPv6 CIDR', () => {
			const cidrs = [parseCIDREntry('2606:4700::/32')].filter(Boolean);
			expect(findCoveringCIDR('2606:4700:4700::1113', cidrs)).not.toBeNull();
		});

		it('does not match IPv4 against IPv6 CIDR', () => {
			const cidrs = [parseCIDREntry('2606:4700::/32')].filter(Boolean);
			expect(findCoveringCIDR('1.1.1.1', cidrs)).toBeNull();
		});

		it('returns null for empty CIDR list', () => {
			expect(findCoveringCIDR('8.8.8.8', [])).toBeNull();
		});

		it('cross-source scenario: Cloudflare CIDR does not absorb DNS resolver IP when filtered by name', () => {
			const cloudflareCIDR = { ...parseCIDREntry('2606:4700::/32'), names: new Set(['Cloudflare']) };
			const dnsIP = '2606:4700:4700::1113';
			const dnsNames = new Set(['DNS Resolvers']);

			const hasSharedName = c => [...c.names].some(n => dnsNames.has(n));
			const sameSourceCIDRs = [cloudflareCIDR].filter(hasSharedName);
			expect(findCoveringCIDR(dnsIP, sameSourceCIDRs)).toBeNull();
		});

		it('cross-source scenario: same-source CIDR does absorb its own IP', () => {
			const cloudflareCIDR = { ...parseCIDREntry('2606:4700::/32'), names: new Set(['Cloudflare']) };
			const ipNames = new Set(['Cloudflare']);

			const hasSharedName = c => [...c.names].some(n => ipNames.has(n));
			const sameSourceCIDRs = [cloudflareCIDR].filter(hasSharedName);
			expect(findCoveringCIDR('2606:4700:4700::1113', sameSourceCIDRs)).not.toBeNull();
		});
	});
});
