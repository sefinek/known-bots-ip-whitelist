class ValidationError extends Error {
	constructor(message, field) {
		super(message);
		this.name = 'ValidationError';
		this.field = field;
	}
}

class NetworkError extends Error {
	constructor(message, originalError = null) {
		super(message);
		this.name = 'NetworkError';
		this.originalError = originalError;
		this.code = originalError?.code;
	}
}

class SecurityError extends Error {
	constructor(message) {
		super(message);
		this.name = 'SecurityError';
	}
}

class TimeoutError extends Error {
	constructor(message, timeout) {
		super(message);
		this.name = 'TimeoutError';
		this.timeout = timeout;
	}
}

module.exports = {
	ValidationError,
	NetworkError,
	SecurityError,
	TimeoutError,
};