module.exports = {
	info: msg => console.log('[INFO ]', msg),
	debug: msg => console.log('[DEBUG]', msg),
	warn: msg => console.warn('[WARN ]', msg),
	err: msg => console.error('[FAIL ]', msg),
};