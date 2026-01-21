const { describe, it, expect } = require('@jest/globals');
const { validateUrl, validateSource } = require('../scripts/utils/validation.js');
const { SecurityError, ValidationError } = require('../scripts/utils/errors.js');

describe('validateUrl', () => {
	it('validates https URLs', () => {
		expect(validateUrl('https://example.com')).toBe('https://example.com');
	});

	it('validates http URLs', () => {
		expect(validateUrl('http://example.com')).toBe('http://example.com');
	});

	it('rejects non-http protocols', () => {
		expect(() => validateUrl('file:///etc/passwd')).toThrow(SecurityError);
		expect(() => validateUrl('ftp://example.com')).toThrow(SecurityError);
		expect(() => validateUrl('javascript:alert(1)')).toThrow(SecurityError);
	});

	it('rejects invalid URLs', () => {
		expect(() => validateUrl('not a url')).toThrow(SecurityError);
		expect(() => validateUrl('')).toThrow(SecurityError);
		expect(() => validateUrl(null)).toThrow(SecurityError);
	});

	it('accepts URLs with encoded spaces', () => {
		// URLs with spaces get automatically encoded by URL constructor
		expect(() => validateUrl('https://example.com/path%20with%20spaces')).not.toThrow();
	});
});

describe('validateSource', () => {
	it('validates valid source configuration', () => {
		const source = {
			name: 'TestBot',
			type: 'hosts',
			url: 'https://example.com/ips.txt',
		};
		expect(() => validateSource(source)).not.toThrow();
	});

	it('validates source with array of URLs', () => {
		const source = {
			name: 'TestBot',
			type: 'textMulti',
			url: ['https://example.com/ipv4', 'https://example.com/ipv6'],
		};
		expect(() => validateSource(source)).not.toThrow();
	});

	it('rejects source without name', () => {
		const source = { type: 'hosts', url: 'https://example.com' };
		expect(() => validateSource(source)).toThrow(ValidationError);
		expect(() => validateSource(source)).toThrow('Source name is required');
	});

	it('rejects source without type', () => {
		const source = { name: 'TestBot', url: 'https://example.com' };
		expect(() => validateSource(source)).toThrow(ValidationError);
		expect(() => validateSource(source)).toThrow('Source type is required');
	});

	it('rejects source with invalid URL in array', () => {
		const source = {
			name: 'TestBot',
			type: 'textMulti',
			url: ['https://example.com', 'ftp://bad.com'],
		};
		expect(() => validateSource(source)).toThrow(SecurityError);
	});

	it('rejects null or undefined source', () => {
		expect(() => validateSource(null)).toThrow(ValidationError);
		expect(() => validateSource(undefined)).toThrow(ValidationError);
	});

	it('rejects source with invalid name type', () => {
		const source = { name: 123, type: 'hosts' };
		expect(() => validateSource(source)).toThrow(ValidationError);
	});
});
