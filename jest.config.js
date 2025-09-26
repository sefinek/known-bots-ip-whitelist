module.exports = {
	testEnvironment: 'node',
	testTimeout: 30000,
	detectOpenHandles: true,
	forceExit: true,
	clearMocks: true,
	setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
};