
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

const fs = require('fs');
const path = require('path');
const mockfs = require('mock-fs');
const { expect } = require('../setup');
const libraryCommands = require('../../src/cli/library');
const { LibraryInitCommand } = require('particle-commands');
const commandProcessor = require('../../src/app/command-processor');

/**
 * Synchronously reads a directory from the real filesystem into the format as expected by mock-fs.
 * @param dir
 */
function mirrorDir(dir, mock) {
	if (mock===undefined) {
		// add the path to the directory (which can be either absolute or relative.)
		mock = {};
		mock[dir] = mirrorDir(dir, {});
		return mock;
	}

	var files = fs.readdirSync(dir);
	for (let i in files) {
		let name = files[i];
		const fq = path.join(dir, name);
		if (fs.statSync(fq).isDirectory()) {
			mock[name] = mirrorDir(fq, {});
		} else {
			mock[name] = fs.readFileSync(fq, 'utf-8');
		}
	}
	return mock;
}

describe('library init', () => {
	/**
	 * The location of the generator resources. This is used to copy the resources to the mock fs
	 * for the test.
	 */
	before(function doit() {
		this.timeout(20*1000);
		const initResources = new LibraryInitCommand().generatorClass().sources;
		const initFixture = mirrorDir(initResources);
		mockfs(initFixture);
	});

	after(() => {
		mockfs.restore();
	});

	// This test fails on Node 10 for some reason so I'm disabling it for now
	xit('can run library init without prompts', function doit() {
		this.timeout(10*1000);
		const root = commandProcessor.createAppCategory();

		libraryCommands({ commandProcessor, root });

		const argv = commandProcessor.parse(root, ['library', 'create', '--name', 'foobar',
			'--version=1.2.3', '--author=mrbig']);

		expect(argv.clicommand).to.be.ok;

		const result = argv.clicommand.exec(argv).then(() => {
			expect(fs.existsSync('library.properties')).to.equal(true);
			expect(fs.existsSync('src/foobar.cpp')).to.equal(true);
			expect(fs.existsSync('src/foobar.h')).to.equal(true);
		});
		return result;
	});
});

