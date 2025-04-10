module.exports = {
	extends: ['eslint-config-particle'],
	parserOptions: {
		ecmaVersion: 13,
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
		'no-console': 'off',
		'valid-jsdoc': 'off',
		'max-depth': ['warn', 5],
		'max-statements': ['warn', 40]
	}
};

