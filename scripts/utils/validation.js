const { ValidationError, SecurityError } = require('./errors.js');
const ALLOWEd_COMMANDS = ['test', 'lint', 'build'];

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
	if (!isValidUrl(url)) throw new SecurityError(`Invalid URL: ${url}`);
	return url;
};

const validateSource = source => {
	if (!source || typeof source !== 'object') throw new ValidationError('Invalid source configuration', 'source');
	if (!source.name || typeof source.name !== 'string') throw new ValidationError('Source name is required', 'name');
	if (!source.type || typeof source.type !== 'string') throw new ValidationError('Source type is required', 'type');

	if (source.url) {
		if (Array.isArray(source.url)) {
			source.url.forEach(validateUrl);
		} else {
			validateUrl(source.url);
		}
	}

	return source;
};

const validateSourcesConfig = config => {
	if (!Array.isArray(config) || !config.length) throw new ValidationError('Sources configuration must be a non-empty array', 'sources');

	return config.map((src, index) => {
		const validated = { ...validateSource(src) };
		if (!validated.dir || typeof validated.dir !== 'string') throw new ValidationError('Source dir is required', `sources[${index}].dir`);

		if (validated.extraFiles) {
			const extra = Array.isArray(validated.extraFiles) ? validated.extraFiles : [validated.extraFiles];
			validated.extraFiles = extra.filter(f => typeof f === 'string' && f.trim());
		}

		return validated;
	});
};

const validateCommandArgs = args => {
	if (!Array.isArray(args) || !args.length) throw new SecurityError('Invalid command arguments');

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

	if (!ALLOWEd_COMMANDS.includes(command)) {
		throw new SecurityError(`Command not allowed: ${command}`);
	}

	return args;
};

module.exports = {
	isValidUrl,
	validateUrl,
	validateSource,
	validateSourcesConfig,
	validateCommandArgs,
};
