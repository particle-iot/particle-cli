
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

const path = require('path');
const settings = require('../../settings');
const { expect, sinon } = require('../setup');
const { itHasAccessToken, fetchAccessToken } = require('./access_token');
const { LibraryAddCommand, LibraryAddCommandSite } = require('../../src/cmd');
const commandProcessor = require('../../src/app/command-processor');
const createLibraryCommand = require('../../src/cli/library');
const { resourcesDir } = require('particle-library-manager');
const ParticleApi = require('../../src/cmd/api');


describe('library', () => {
	before(()=> {
		settings.whichProfile();
		settings.loadOverrides();
	});

	const libraryDir = path.join(resourcesDir(), 'libraries');
	const root = commandProcessor.createAppCategory();
	createLibraryCommand({ commandProcessor, root });

	describe('migrate', () => {
		it('supports --dryrun flag', () => {
			const argv = commandProcessor.parse(root, ['library', 'migrate', '--dryrun']);
			expect(argv).to.have.property('dryrun').equal(true);
			expect(argv).to.have.property('clicommand');
		});

		it('can execute --test flag', () => {
			const argv = commandProcessor.parse(root, ['library', 'migrate', '--dryrun', path.join(libraryDir, 'libraries-v1')]);
			return argv.clicommand.exec(argv);
		});
	});

	describe('add', () => {
		it('populates the library name', () => {
			const argv = commandProcessor.parse(root, ['library', 'add', 'assettracker']);
			expect(argv.params).to.have.property('name').equal('assettracker');
		});

		it('requires the library name', () => {
			const argv = commandProcessor.parse(root, ['library', 'add']);
			const error = commandProcessor.errors.requiredParameterError('name');

			expect(argv.clierror).to.not.be.undefined;
			expect(argv.clierror).to.have.keys(Object.keys(error));
			expect(argv.clierror.stack).to.be.a('string').with.lengthOf.above(100);
			expect(argv.clierror.isUsageError).to.equal(error.isUsageError);
			expect(argv.clierror.message).to.equal(error.message);
			expect(argv.clierror.type).to.eql(error.type);
			expect(argv.clierror.data).to.eql(error.data);
			expect(argv.clierror.item).to.eql(error.item);
		});

		itHasAccessToken('can fetch a list of libraries with a filter', () => {
			// todo - I copied this from the libraryAdd command - why do we need to specify access token twice? --mdma
			const apiJS = new ParticleApi(settings.apiUrl, {
				accessToken: fetchAccessToken()
			}).api;

			const apiClient = apiJS.client({ auth: settings.access_token });
			const sut = new LibraryAddCommand({ apiClient });
			const site = new LibraryAddCommandSite();
			site.notifyListLibrariesStart = sinon.spy(site.notifyListLibrariesStart);
			site.notifyListLibrariesComplete = sinon.spy(site.notifyListLibrariesComplete);

			return sut.listLibraries(site, 'neo').then(result => {
				expect(Array.isArray(result)).to.be.true;

				const names = result.map( (item) => {
					expect(item).has.property('name');
					return item.name;
				} );

				expect(names).to.include('neopixel');
				expect(site.notifyListLibrariesStart).to.be.calledOnce;
				expect(site.notifyListLibrariesComplete).to.be.calledOnce;
			});
		});

		it('adds a library to an existing project', () => {
			// TODO!
		});
	});
	// todo - exit codes for the command? or command response.
});

