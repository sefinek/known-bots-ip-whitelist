const { describe, beforeEach, it, expect, jest: jestMock } = require('@jest/globals');

jestMock.mock('../scripts/services/axios.js');
jestMock.mock('../scripts/services/whois.js');
jestMock.mock('../scripts/parser/yandex.js');

const fetchSource = require('../scripts/fetchSource.js');
const axios = require('../scripts/services/axios.js');
const getASNPrefixes = require('../scripts/services/whois.js');
const getYandexIPs = require('../scripts/parser/yandex.js');

describe('fetchSource', () => {
	beforeEach(() => {
		jestMock.clearAllMocks();
	});

	describe('whois type', () => {
		it('returns records from WHOIS/RIPEstat', async () => {
			getASNPrefixes.mockResolvedValue([{ ip: '1.2.3.4', source: 'whois' }]);

			const out = await fetchSource({ name: 'Test', asn: 'AS123', type: 'whois' });
			expect(out).toEqual([{ ip: '1.2.3.4', sources: ['whois'] }]);
		});

		it('returns empty array when no records', async () => {
			getASNPrefixes.mockResolvedValue([]);

			const out = await fetchSource({ name: 'Test', asn: 'AS123', type: 'whois' });
			expect(out).toEqual([]);
		});
	});

	describe('yandex type', () => {
		it('returns Yandex IPs', async () => {
			getYandexIPs.mockResolvedValue([{ ip: '77.88.5.5', source: 'yandex' }]);

			const out = await fetchSource({ name: 'YandexBot', type: 'yandex' });
			expect(out).toEqual([{ ip: '77.88.5.5', sources: ['yandex'] }]);
		});
	});

	describe('hosts type', () => {
		it('parses plain-text IP list', async () => {
			axios.get.mockResolvedValue({ data: '1.1.1.1\n2.2.2.2\n' });

			const out = await fetchSource({ name: 'Test', url: 'https://example.com/ips.txt', type: 'hosts' });
			expect(out).toEqual([
				{ ip: '1.1.1.1', sources: ['https://example.com/ips.txt'] },
				{ ip: '2.2.2.2', sources: ['https://example.com/ips.txt'] },
			]);
		});

		it('skips comment lines and blank lines', async () => {
			axios.get.mockResolvedValue({ data: '# comment\n1.1.1.1\n\n2.2.2.2' });

			const out = await fetchSource({ name: 'Test', url: 'https://example.com/ips.txt', type: 'hosts' });
			expect(out.map(r => r.ip)).toEqual(['1.1.1.1', '2.2.2.2']);
		});

	});

	describe('textMulti type', () => {
		it('fetches and merges multiple URLs', async () => {
			axios.get
				.mockResolvedValueOnce({ data: '1.1.1.1' })
				.mockResolvedValueOnce({ data: '2.2.2.2' });

			const out = await fetchSource({
				name: 'Test',
				url: ['https://example.com/ipv4', 'https://example.com/ipv6'],
				type: 'textMulti',
			});
			expect(out.map(r => r.ip)).toEqual(expect.arrayContaining(['1.1.1.1', '2.2.2.2']));
		});
	});

	describe('jsonPrefixes type', () => {
		it('parses ipv4Prefix entries', async () => {
			axios.get.mockResolvedValue({
				data: { prefixes: [{ ipv4Prefix: '23.98.142.0/28' }, { ipv4Prefix: '20.15.240.64/28' }] },
			});

			const out = await fetchSource({ name: 'GPTBot', url: 'https://openai.com/gptbot.json', type: 'jsonPrefixes' });
			expect(out.map(r => r.ip)).toEqual(expect.arrayContaining(['23.98.142.0/28', '20.15.240.64/28']));
		});

		it('parses ipv6Prefix entries', async () => {
			axios.get.mockResolvedValue({
				data: { prefixes: [{ ipv6Prefix: '2001:db8::/32' }] },
			});

			const out = await fetchSource({ name: 'TestBot', url: 'https://example.com/bot.json', type: 'jsonPrefixes' });
			expect(out.map(r => r.ip)).toContain('2001:db8::/32');
		});

		it('accepts array of URLs and merges results', async () => {
			axios.get
				.mockResolvedValueOnce({ data: { prefixes: [{ ipv4Prefix: '1.2.3.0/24' }] } })
				.mockResolvedValueOnce({ data: { prefixes: [{ ipv4Prefix: '5.6.7.0/24' }] } });

			const out = await fetchSource({
				name: 'TestBot',
				url: ['https://example.com/a.json', 'https://example.com/b.json'],
				type: 'jsonPrefixes',
			});
			expect(out.map(r => r.ip)).toEqual(expect.arrayContaining(['1.2.3.0/24', '5.6.7.0/24']));
		});
	});

	describe('jsonIps type', () => {
		it('parses ip_address entries', async () => {
			axios.get.mockResolvedValue({
				data: { ips: [{ ip_address: '1.2.3.4' }, { ip_address: '5.6.7.8' }] },
			});

			const out = await fetchSource({ name: 'AhrefsBot', url: 'https://api.ahrefs.com/crawler-ips', type: 'jsonIps' });
			expect(out.map(r => r.ip)).toEqual(['1.2.3.4', '5.6.7.8']);
		});
	});

	describe('unknown type', () => {
		it('throws on unknown source type', async () => {
			await expect(fetchSource({ name: 'Test', type: 'nonexistent' })).rejects.toThrow('Unknown source type');
		});
	});
});
