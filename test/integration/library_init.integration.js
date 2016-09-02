
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

import {expect} from '../test-setup';
const path = require('path');
const mockfs = require('mock-fs');
const fs = require('fs');

import * as cli from '../../src/app/nested-yargs';
import libraryInit from '../../src/cli/library_init';

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

function getFiles (dir, files_){
	files_ = files_ || [];
	var files = fs.readdirSync(dir);
	for (var i in files){
		var name = path.join(dir, files[i]);
		if (fs.statSync(name).isDirectory()){
			getFiles(name, files_);
		} else {
			files_.push(name);
		}
	}
	return files_;
}

/**
 * The location of the generator resources. This is used to copy the resources to the mock fs
 * for the test.
 */
const initResources = require.resolve('particle-cli-library-manager/dist/init');
const initFixture = mirrorDir(path.join(initResources, '..', 'templates'));

describe('library init', () => {

	before(done => {
		mockfs(initFixture);
		done();
	});

	after(done => {
		mockfs.restore();
		done();
	});

	it('can run library init without prompts', () => {
		const app = cli.createAppCategory();
		const lib = cli.createCategory(app, 'library');
		libraryInit({lib, factory:cli});
		const argv = cli.parse(app, ['library', 'init', '--name', 'foobar',
			'--version=123', '--author=mrbig']);
		expect(argv.clicommand).to.be.ok;

		const result = argv.clicommand.exec(argv).then(() => {
			expect(fs.existsSync('library.properties')).to.equal(true);
			expect(fs.existsSync('src/foobar.cpp')).to.equal(true);
			expect(fs.existsSync('src/foobar.h')).to.equal(true);
		});
		return result;
	});

});