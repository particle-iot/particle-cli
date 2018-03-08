#!/usr/bin/env node
/* eslint no-var: 0 */
global.verboseLevel = 1;
require('../minimumNode')();
const CLI = cliForEnvironment();
new CLI().run(process.argv);

function cliForEnvironment() {
	if (process.env.PARTICLE_CLI_DEVELOPMENT) {
		require('babel-register');
		return require('../src/app/cli');
	} else {
		return require('../dist/app/cli');
	}
}
