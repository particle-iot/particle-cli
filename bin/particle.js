#!/usr/bin/env node
/* eslint no-var: 0 */
global.verboseLevel = 1;
require('../minimumNode')();
const CLI = cliForEnvironment();
new CLI().run(process.argv);

function cliForEnvironment() {
	return require('../dist/app/cli');
}
