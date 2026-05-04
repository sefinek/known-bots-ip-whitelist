const { describe, it, expect } = require('@jest/globals');
const { validateUrl, validateSource, validateSourcesConfig } = require('../scripts/utils/validation.js');
const { SecurityError, ValidationError } = require('../scripts/utils/errors.js');

describe('validateUrl', () => {
	it('accepts https URLs', () => {
		expect(validateUrl('https://example.com')).toBe('https://example.com');
	});

	it('accepts http URLs', () => {
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
});

describe('validateSource', () => {
	it('accepts valid source', () => {
		expect(() => validateSource({ name: 'TestBot', type: 'hosts', url: 'https://example.com/ips.txt' })).not.toThrow();
	});

	it('accepts source with array of URLs', () => {
		expect(() => validateSource({ name: 'TestBot', type: 'textMulti', url: ['https://example.com/ipv4', 'https://example.com/ipv6'] })).not.toThrow();
	});

	it('rejects missing name', () => {
		expect(() => validateSource({ type: 'hosts', url: 'https://example.com' })).toThrow(ValidationError);
	});

	it('rejects missing type', () => {
		expect(() => validateSource({ name: 'TestBot', url: 'https://example.com' })).toThrow(ValidationError);
	});

	it('rejects invalid URL in array', () => {
		expect(() => validateSource({ name: 'TestBot', type: 'textMulti', url: ['https://example.com', 'ftp://bad.com'] })).toThrow(SecurityError);
	});

	it('rejects null or undefined', () => {
		expect(() => validateSource(null)).toThrow(ValidationError);
		expect(() => validateSource(undefined)).toThrow(ValidationError);
	});

	it('rejects non-string name', () => {
		expect(() => validateSource({ name: 123, type: 'hosts' })).toThrow(ValidationError);
	});
});

describe('validateSourcesConfig', () => {
	const makeSource = (overrides = {}) => ({
		name: 'TestBot',
		dir: 'testbot',
		category: 'crawlers',
		url: 'https://example.com/ips.txt',
		type: 'hosts',
		...overrides,
	});

	it('accepts valid config', () => {
		expect(() => validateSourcesConfig([makeSource()])).not.toThrow();
	});

	it('accepts all valid categories', () => {
		const categories = ['crawlers', 'monitoring', 'infrastructure', 'ai'];
		categories.forEach((category, i) => {
			expect(() => validateSourcesConfig([makeSource({ name: `Bot${i}`, dir: `bot${i}`, category })])).not.toThrow();
		});
	});

	it('accepts source without category', () => {
		const src = makeSource();
		delete src.category;
		expect(() => validateSourcesConfig([src])).not.toThrow();
	});

	it('rejects empty array', () => {
		expect(() => validateSourcesConfig([])).toThrow(ValidationError);
	});

	it('rejects non-array', () => {
		expect(() => validateSourcesConfig(null)).toThrow(ValidationError);
		expect(() => validateSourcesConfig({})).toThrow(ValidationError);
	});

	it('rejects missing dir', () => {
		const src = makeSource();
		delete src.dir;
		expect(() => validateSourcesConfig([src])).toThrow(ValidationError);
	});

	it('rejects unknown category', () => {
		expect(() => validateSourcesConfig([makeSource({ category: 'unknown' })])).toThrow(ValidationError);
	});

	it('normalizes extraFiles to array', () => {
		const result = validateSourcesConfig([makeSource({ extraFiles: ['file.txt'] })]);
		expect(Array.isArray(result[0].extraFiles)).toBe(true);
	});

	it('accepts multiple sources', () => {
		const sources = [
			makeSource({ name: 'BotA', dir: 'bota' }),
			makeSource({ name: 'BotB', dir: 'botb', category: 'ai' }),
			makeSource({ name: 'BotC', dir: 'botc', category: 'monitoring', url: 'https://example.com/b.txt' }),
		];
		expect(() => validateSourcesConfig(sources)).not.toThrow();
	});
});
