
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
import createLibraryCommand from '../../src/cmd/library';
import * as cli from '../../src/cli/nested-yargs';
import { resourcesDir } from 'particle-cli-library-manager';

describe("library", () => {

	const libraryDir = path.join(resourcesDir(), 'libraries');

	describe('migrate', () => {
		it('supports --dryrun flag', () => {
			const app = cli.createAppCategory();
			createLibraryCommand(app, cli);
			const argv = cli.parse(app, ['library', 'migrate', '--dryrun']);
			expect(argv).to.have.property('dryrun').equal(true);
			expect(argv).to.have.property('clicommand');
		});

		it('can execute --test flag', () => {
			const app = cli.createAppCategory();
			createLibraryCommand(app, cli);
			const argv = cli.parse(app, ['library', 'migrate', '--dryrun', path.join(libraryDir, 'libraries-v1')]);
			return argv.clicommand.exec(argv);
		});
	});

	describe('add', () => {
		it('populates the library name', () => {
			const app = cli.createAppCategory();
			createLibraryCommand(app, cli);
			const argv = cli.parse(app, ['library', 'add', 'assettracker']);
			expect(argv).to.have.property('name').equal('assettracker');
		});
	});


	// todo - exit codes for the command? or command response.

});