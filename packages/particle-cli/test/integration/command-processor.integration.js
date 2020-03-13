/*
 ******************************************************************************
 Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU Lesser General Public
 License as published by the Free Software Foundation, either
 version 3 of the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public
 License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */

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
				if (expected!==undefined) {
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
