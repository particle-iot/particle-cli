module.exports = {
	extends: ['eslint-config-particle'],
	parserOptions: {
		ecmaVersion: 8,
		sourceType: 'module'
	},
	env: {
		commonjs: true,
		es6: true,
		node: true,
		mocha: true,
		worker: true
	},
	rules: {
		'no-var': 2,
		'no-console': 0,
		'valid-jsdoc': 0
	}
};

