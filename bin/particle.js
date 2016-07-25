#!/usr/bin/env node
/* eslint no-var: 0 */
global.verboseLevel = 1;
var app = appForEnvironment();
app.default.run(process.argv);

function appForEnvironment() {
	if (process.env.PARTICLE_CLI_DEVELOPMENT) {
		require('babel-register');
		return require('../src/app/app');
	} else {
		return require('../dist/app/app');
	}
}
