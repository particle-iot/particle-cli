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

import {chai, sinon, expect} from '../test-setup';
chai.use(require('chai-fs'));
const settings = require('../../settings');
const path = require('path');
const mockfs = require('mock-fs');
const fs = require('fs');

import * as cli from '../../src/cli/nested-yargs';
import libraryInstall from '../../src/cmd/library_install';

describe('library install', () => {

	beforeEach(done => {
		mockfs();
		done();
	});

	afterEach(done => {
		mockfs.restore();
		done();
	});

	it('can install a vendored library in an extended application project', () => {
		// todo - get access token from the environment
		const auth = 'a1756ba10078bfacd21a26d68c1a6bb2274e565a';
		settings.access_token = auth;

		fs.mkdirSync('project');
		fs.writeFileSync('project/project.properties', '');
		fs.mkdirSync('project/src');
		process.chdir('project');
		const app = cli.createAppCategory();
		const lib = cli.createCategory(app, 'library');
		libraryInstall(lib, cli);
		const argv = cli.parse(app, ['library', 'install', '--vendored', 'neopixel']);
		expect(argv.clicommand).to.be.ok;

		const result = argv.clicommand.exec(argv).then(() => {
			expect('lib/neopixel/library.properties').to.be.a.file;
			expect('lib/neopixel/src/neopixel.cpp').to.be.a.file;
			expect('lib/neopixel/src/neopixel.h').to.be.a.file;
		});
		return result;
	});
});