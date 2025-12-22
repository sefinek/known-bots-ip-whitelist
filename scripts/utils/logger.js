const isDebugEnabled = process.argv.includes('--debug');

module.exports = {
	info: msg => console.log('[i]', msg),
	success: msg => console.log('[✓]', msg),
	debug: msg => {
		if (isDebugEnabled) console.debug('[D]', msg);
	},
	warn: msg => console.warn('[!]', msg),
	err: msg => console.error('[X]', msg),
};
