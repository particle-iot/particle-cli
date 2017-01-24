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
import {it_has_access_token, fetch_access_token} from './access_token';
const settings = require('../../settings');
const path = require('path');
const mockfs = require('mock-fs');
const when = require('when');

import * as cli from '../../src/app/nested-yargs';



describe('library install', () => {

	let token;

	beforeEach(() => {
		token = settings.access_token;
		settings.access_token = fetch_access_token();
		mockfs();
	});

	afterEach((done) => {
		settings.access_token = token;
		console.log('restore fs');
		mockfs.restore();
		done();
	});

	it_has_access_token('can install a vendored library in an extended application project', function test() {
		this.timeout(20*1000);
		const fs = require('fs');
		fs.mkdirSync('project');
		process.chdir('./project');
		fs.writeFileSync('project.properties', '');
		fs.mkdirSync('src');


		const libraryInstall = require('../../src/cli/library_install').default;

		const app = cli.createAppCategory();
		const lib = cli.createCategory(app, 'library');
		libraryInstall({lib, factory:cli});
		const argv = cli.parse(app, ['library', 'install', '--vendored', 'neopixel']);
		expect(argv.clicommand).to.be.ok;

		var _getAllFilesFromFolder = function(dir) {

			var filesystem = require("fs");
			var results = [];

			filesystem.readdirSync(dir).forEach(function(file) {

				file = dir+'/'+file;
				var stat = filesystem.statSync(file);

				if (stat && stat.isDirectory()) {
					results = results.concat(_getAllFilesFromFolder(file))
				} else results.push(file);

			});

			return results;
		};

		const result = argv.clicommand.exec(argv).then(() => {
			[
			'lib/neopixel/library.properties',
			'lib/neopixel/src/neopixel.cpp',
			'lib/neopixel/src/neopixel.h',
			'./lib/neopixel/examples/rgbw-strandtest/rgbw-strandtest.cpp'
			].forEach(filename => {
				expect(fs.statSync(filename).isFile()).to.be.true;
			});
		});
		return expect(result).to.eventually.be.fulfilled;
	});
});
