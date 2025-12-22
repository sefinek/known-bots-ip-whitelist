module.exports = {
	info: msg => console.log('[i]', msg),
	success: msg => console.log('[✓]', msg),
	debug: msg => console.debug('[D]', msg),
	warn: msg => console.warn('[!]', msg),
	err: msg => console.error('[X]', msg),
};
