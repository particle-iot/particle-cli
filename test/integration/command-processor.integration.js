'use strict';
const { expect } = require('../setup');
const CLI = require('../../src/app/cli');
const commandProcessor = require('../../src/app/command-processor');


describe('command line parsing', () => {
	describe('global flags', () => {
		describe('verbosity', () => {
			const rootCategory = new CLI().rootCategory;

			function assertVerbosity(argv, expected) {
				if (argv.clierror) {
					throw argv.clierror;
				}
				if (expected !== undefined) {
					expect(global).to.have.property('verboseLevel').equal(expected);
				} else {
					expect(global).to.not.have.property('verboseLevel');
				}
			}

			it('is 1 by default', () => {
				const argv = commandProcessor.parse(rootCategory, []);
				assertVerbosity(argv, 1);
			});

			it('is 2 for a single v flag', () => {
				const argv = commandProcessor.parse(rootCategory, ['-v']);
				assertVerbosity(argv, 2);
			});

			it('is 3 for a double v flag', () => {
				const argv = commandProcessor.parse(rootCategory, ['-vv']);
				assertVerbosity(argv, 3);
			});

			it('is 0 with one quiet', () => {
				const argv = commandProcessor.parse(rootCategory, ['-q']);
				assertVerbosity(argv, 0);
			});

		});
	});
});
