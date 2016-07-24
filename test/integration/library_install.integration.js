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
const libraryInstall = require('../../src/cmd/library_install');
import {appRoot} from 'particle-cli-library-manager';

describe('library install', () => {

	before(done => {
		mockfs({});
		done();
	});

	after(done => {
		mockfs.restore();
		done();
	});

	it('can install a vendored library', () => {
		const app = cli.createAppCategory();
		const lib = cli.createCategory(app, 'library');
		libraryInstall(lib, cli);
		const argv = cli.parse(app, ['library', 'install', '--vendored', 'neopixel']);
		expect(argv.clicommand).to.be.ok;

		const result = argv.clicommand.exec(argv).then(() => {
			expect(fs.existsSync('lib/neopixel/library.properties')).to.equal(true);
			expect(fs.existsSync('lib/neopixel/src/neopixel.cpp')).to.equal(true);
			expect(fs.existsSync('lib/neopixel/src/neopixel.h')).to.equal(true);
		});
		return result;
	});
});