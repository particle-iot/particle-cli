#!/usr/bin/env node
'use strict';
global.verboseLevel = 1;
// TODO(hmontero): Replace 'request' (uses deprecated 'punycode') with 'fetch'.
process.noDeprecation = true;

const hasValidNodeInstall = require('./lib/has-supported-node');
const applyTrustStore = require('./lib/trust-store');
const { execName } = require('./lib/utilities');
const CLI = require('./app/cli');
const credHelper = require('./docker-credential-helper');

if (hasValidNodeInstall()) {
	applyTrustStore();
	// if called as docker-credential-particle exec that instead
	if (execName() === 'docker-credential-particle') {
		void credHelper.run();
	} else {
		void new CLI().run(process.argv);
	}
}

