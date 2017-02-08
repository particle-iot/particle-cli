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
		var nodeVersion = process.versions.node.split('.');
		if (Number(nodeVersion[0]) < 6) {
			require('babel-polyfill');
		}
		return require('../dist/app/app');
	}
}
