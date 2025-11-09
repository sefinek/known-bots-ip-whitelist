const { ValidationError, SecurityError } = require('./errors.js');

const isValidUrl = url => {
	if (!url || typeof url !== 'string') return false;
	try {
		const parsed = new URL(url);
		return ['http:', 'https:'].includes(parsed.protocol);
	} catch {
		return false;
	}
};

const validateUrl = url => {
	if (!isValidUrl(url)) {
		throw new SecurityError(`Invalid URL: ${url}`);
	}
	return url;
};

const validateSource = source => {
	if (!source || typeof source !== 'object') {
		throw new ValidationError('Invalid source configuration', 'source');
	}
	if (!source.name || typeof source.name !== 'string') {
		throw new ValidationError('Source name is required', 'name');
	}
	if (!source.type || typeof source.type !== 'string') {
		throw new ValidationError('Source type is required', 'type');
	}

	if (source.url) {
		if (Array.isArray(source.url)) {
			source.url.forEach(validateUrl);
		} else {
			validateUrl(source.url);
		}
	}

	return source;
};

const validateCommandArgs = args => {
	const allowedCommands = ['test', 'lint', 'build'];
	if (!Array.isArray(args) || !args.length) {
		throw new SecurityError('Invalid command arguments');
	}

	// Handle: ['npm', 'run', 'test'] -> check args[2]
	// Handle: ['npm', 'test'] -> check args[1]
	let command;
	if (args[0] === 'npm' && args[1] === 'run') {
		command = args[2];
	} else if (args[0] === 'npm') {
		command = args[1];
	} else {
		throw new SecurityError('Only npm commands are allowed');
	}

	if (!allowedCommands.includes(command)) {
		throw new SecurityError(`Command not allowed: ${command}`);
	}

	return args;
};

module.exports = {
	isValidUrl,
	validateUrl,
	validateSource,
	validateCommandArgs,
};