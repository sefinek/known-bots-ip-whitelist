jest.mock('../scripts/services/axios.js');
jest.mock('../scripts/services/whois.js');
jest.mock('../scripts/parser/yandex.js');

const fetchSource = require('../scripts/fetchSource.js');
const axios = require('../scripts/services/axios.js');
const getASNPrefixes = require('../scripts/services/whois.js');
const getYandexIPs = require('../scripts/parser/yandex.js');

describe('fetchSource', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('fetches from RADB', async () => {
		getASNPrefixes.mockResolvedValue([{ ip: '1.2.3.4', source: 'radb' }]);
		const out = await fetchSource({ name: 'Test RADB', asn: 'AS123', type: 'radb' });
		expect(out).toEqual([{ ip: '1.2.3.4', source: 'radb' }]);
	});

	it('fetches Yandex data', async () => {
		getYandexIPs.mockResolvedValue([{ ip: '77.88.5.5', source: 'yandex' }]);
		const out = await fetchSource({ name: 'YandexBot', type: 'yandex' });
		expect(out).toEqual([{ ip: '77.88.5.5', source: 'yandex' }]);
	});

	it('parses hosts file correctly', async () => {
		axios.get.mockResolvedValue({ data: '1.1.1.1\n2.2.2.2\n' });
		const out = await fetchSource({
			name: 'Test',
			url: 'http://example.com/ips.txt',
			type: 'hosts',
		});
		expect(out).toEqual([
			{ ip: '1.1.1.1', source: 'http://example.com/ips.txt' },
			{ ip: '2.2.2.2', source: 'http://example.com/ips.txt' },
		]);
	});
});