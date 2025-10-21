import { particle } from 'eslint-config-particle';

export default particle({
	rootDir: import.meta.dirname,
	testGlobals: 'mocha',
	overrides: {
		'no-console': 'off'
	},
	globalIgnores: [
		'./test/__fixtures__/logic_functions/lf*_proj/*.js'
	]
});
