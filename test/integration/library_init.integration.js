
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

const chai = require('chai');
const sinon = require('sinon');
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const path = require('path');
const mockfs = require('mock-fs');
const fs = require('fs');

import * as cli from '../../src/cli/nested-yargs';
const libraryInit = require('../../src/cmd/library_init');
import {appRoot} from 'particle-cli-library-manager';

/**
 * Synchronously reads a directory from the real filesystem into the format as expected by mock-fs.
 * @param dir
 */
function mirrorDir(dir, mock) {
	if (mock===undefined) {
		mock = {};
		const parts = dir.split(path.sep);
		let subdir = mock;
		for (let p in parts) {
			const next = {};
			subdir['p'] = next;
			subdir = next;
		}
		mirrorDir(dir, subdir);
		return mock;
	}

	var files = fs.readdirSync(dir);
	for (let i in files) {
		let name = files[i];
		const fq = path.join(dir, name);
		if (fs.statSync(fq).isDirectory()) {
			mock['name'] = mirrorDir(fq, {});
		} else {
			mock['name'] = fs.readFileSync(fq, 'utf-8');
		}
	}
	return mock;
}


function getFiles (dir, files_){
	files_ = files_ || [];
	var files = fs.readdirSync(dir);
	for (var i in files){
		var name = dir + '/' + files[i];
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

	it('can run library init without prompts', (done) => {
		const app = cli.createAppCategory();
		libraryInit.default(app, cli);
		const argv = cli.parse(app, ['library', 'init', '--name', 'foo',
			'--version=123', '--author=mrbig']);
		expect(argv.clicommand).to.be.ok;

		const result = argv.clicommand.exec(argv).then(() => {
			console.log(getFiles('/'));

			expect(fs.existsSync('library.properties')).to.equal(true);
			expect(fs.existsSync('foo.cpp')).to.equal(true);
			expect(fs.existsSync('foo.cpp')).to.equal(true);
		});
		return result;
	});

});