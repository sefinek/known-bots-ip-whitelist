const { describe, it, expect } = require('@jest/globals');
const { ValidationError, NetworkError, SecurityError, TimeoutError } = require('../scripts/utils/errors.js');

describe('Custom Error Classes', () => {
	describe('ValidationError', () => {
		it('creates error with message and field', () => {
			const error = new ValidationError('Invalid field', 'email');
			expect(error.message).toBe('Invalid field');
			expect(error.name).toBe('ValidationError');
			expect(error.field).toBe('email');
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe('NetworkError', () => {
		it('creates error with message only', () => {
			const error = new NetworkError('Connection failed');
			expect(error.message).toBe('Connection failed');
			expect(error.name).toBe('NetworkError');
			expect(error.originalError).toBeNull();
			expect(error).toBeInstanceOf(Error);
		});

		it('creates error with original error', () => {
			const original = new Error('ECONNREFUSED');
			original.code = 'ECONNREFUSED';

			const error = new NetworkError('Connection failed', original);
			expect(error.message).toBe('Connection failed');
			expect(error.name).toBe('NetworkError');
			expect(error.originalError).toBe(original);
			expect(error.code).toBe('ECONNREFUSED');
		});
	});

	describe('SecurityError', () => {
		it('creates error with message', () => {
			const error = new SecurityError('Command injection detected');
			expect(error.message).toBe('Command injection detected');
			expect(error.name).toBe('SecurityError');
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe('TimeoutError', () => {
		it('creates error with message and timeout', () => {
			const error = new TimeoutError('Operation timed out', 5000);
			expect(error.message).toBe('Operation timed out');
			expect(error.name).toBe('TimeoutError');
			expect(error.timeout).toBe(5000);
			expect(error).toBeInstanceOf(Error);
		});
	});
});
