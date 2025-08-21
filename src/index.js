#!/usr/bin/env node

global.verboseLevel = 1;

const hasValidNodeInstall = require('./lib/has-supported-node');
const CLI = require('./app/cli');
const credHelper = require('./docker-credential-helper');


if (hasValidNodeInstall()) {
	// if called as docker-credential-particle exec that instead
	if (process.argv[0] === 'docker-credential-particle') {
		credHelper.runGetCommand();
	} else {
		new CLI().run(process.argv);
	}
}

