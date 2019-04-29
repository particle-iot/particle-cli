#!/usr/bin/env node
/* eslint no-var: 0 */
global.verboseLevel = 1;
require('../minimumNode')();

initCLI().run(process.argv);

function initCLI(){
	let CLI;

	if (process.env.PARTICLE_CLI_DEVELOPMENT){
		CLI = require('../src/app/cli');
	} else {
		CLI = require('../dist/app/cli');
	}

	return new CLI();
}
