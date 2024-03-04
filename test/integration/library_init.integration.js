
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
const fs = require('fs-extra');
const path = require('path');
const libraryCommands = require('../../src/cli/library');
const commandProcessor = require('../../src/app/command-processor');
const { PATH_TMP_DIR } = require('../lib/env');
const { delay } = require('../lib/mocha-utils');

describe('library init', () => {

	after(async () => {
		await fs.remove(path.join(PATH_TMP_DIR, 'lib'));
	});

	it('can run library init without prompts', async function libraryCreate(){
		this.timeout(18*1000);
		const root = commandProcessor.createAppCategory();

		libraryCommands({ commandProcessor, root });

		await fs.ensureDir(path.join(PATH_TMP_DIR, 'lib'));
		const argv = commandProcessor.parse(root, ['library', 'create', '--name', 'foobar',
			'--version=1.2.3', '--author=mrbig', '--dir', path.join(PATH_TMP_DIR, 'lib')]);

		expect(argv.clicommand).to.be.ok;

		await argv.clicommand.exec(argv);
		await delay(1000); // wait for the generator to finish
		expect(fs.existsSync(path.join(PATH_TMP_DIR, 'lib', 'library.properties'))).to.equal(true);
		expect(fs.existsSync(path.join(PATH_TMP_DIR, 'lib','src', 'foobar.cpp'))).to.equal(true);
		expect(fs.existsSync(path.join(PATH_TMP_DIR, 'lib', 'src', 'foobar.h'))).to.equal(true);
	});
});

