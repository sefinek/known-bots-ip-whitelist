const { describe, beforeEach, it, expect, jest: jestMock } = require('@jest/globals');

jestMock.mock('../scripts/services/axios.js');
jestMock.mock('../scripts/utils/retry.js', () => ({
	executeWithRetry: fn => fn(),
}));

const axios = require('../scripts/services/axios.js');
const fetchFromRIPEstat = require('../scripts/services/ripestat.js');

const src = asn => ({ name: 'TestBot', asn });

describe('fetchFromRIPEstat', () => {
	beforeEach(() => {
		jestMock.clearAllMocks();
	});

	it('returns IPs from valid response', async () => {
		axios.get.mockResolvedValue({
			data: {
				status: 'ok',
				data: {
					prefixes: [
						{ prefix: '1.2.3.0/24' },
						{ prefix: '5.6.7.0/24' },
					],
				},
			},
		});

		const result = await fetchFromRIPEstat(src('12345'), false);
		expect(result).toEqual([
			{ ip: '1.2.3.0/24', source: 'https://stat.ripe.net' },
			{ ip: '5.6.7.0/24', source: 'https://stat.ripe.net' },
		]);
	});

	it('returns empty array when status is not ok', async () => {
		axios.get.mockResolvedValue({
			data: { status: 'error', data: null },
		});

		const result = await fetchFromRIPEstat(src('12345'), false);
		expect(result).toEqual([]);
	});

	it('returns empty array when prefixes are missing', async () => {
		axios.get.mockResolvedValue({
			data: { status: 'ok', data: {} },
		});

		const result = await fetchFromRIPEstat(src('12345'), false);
		expect(result).toEqual([]);
	});

	it('skips entries with invalid prefix', async () => {
		axios.get.mockResolvedValue({
			data: {
				status: 'ok',
				data: {
					prefixes: [
						{ prefix: 'not-an-ip' },
						{ prefix: '1.2.3.0/24' },
					],
				},
			},
		});

		const result = await fetchFromRIPEstat(src('12345'), false);
		expect(result).toHaveLength(1);
		expect(result[0].ip).toBe('1.2.3.0/24');
	});

	it('skips entries with null or missing prefix', async () => {
		axios.get.mockResolvedValue({
			data: {
				status: 'ok',
				data: { prefixes: [null, {}, { prefix: '8.8.0.0/16' }] },
			},
		});

		const result = await fetchFromRIPEstat(src('12345'), false);
		expect(result).toHaveLength(1);
		expect(result[0].ip).toBe('8.8.0.0/16');
	});

	it('returns empty array on network error', async () => {
		axios.get.mockRejectedValue(new Error('ECONNREFUSED'));

		const result = await fetchFromRIPEstat(src('12345'), false);
		expect(result).toEqual([]);
	});

	it('retries on 429 and returns result after retry', async () => {
		const rateLimitErr = Object.assign(new Error('Too Many Requests'), {
			response: { status: 429 },
		});

		axios.get
			.mockRejectedValueOnce(rateLimitErr)
			.mockResolvedValueOnce({
				data: {
					status: 'ok',
					data: { prefixes: [{ prefix: '9.9.9.0/24' }] },
				},
			});

		const result = await fetchFromRIPEstat(src('12345'), false, 0);
		expect(result).toEqual([{ ip: '9.9.9.0/24', source: 'https://stat.ripe.net' }]);
	}, 60000);
});
