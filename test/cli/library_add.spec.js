
import {expect, sinon} from '../test-setup';
import fs from 'fs';
import path from 'path';

import {LibraryAddCommand} from '../../src/cmd';
import {LibraryAddCommandSite} from '../../src/cmd';

describe('LibraryAddCommand', () => {

	let mockfs;
	beforeEach((done) => {
		mockfs = require('mock-fs');
		mockfs({});
		done();
	});

	afterEach((done) => {
		mockfs.restore();
		done();
	});

	it('adds a library to a project', () => {
		const dir = '.';
		fs.writeFileSync(path.join(dir, 'project.properties'), '');
		const testSite = sinon.createStubInstance(LibraryAddCommandSite);
		const apiClient = {
			library: sinon.stub()
		};
		testSite.apiClient.withArgs().resolves(apiClient);
		testSite.projectDir.withArgs().returns(dir);
		testSite.fetchingLibrary.withArgs().callsFake(promise => promise);
		testSite.libraryIdent.withArgs().returns({ name: 'neopixel' });
		testSite.addedLibrary.withArgs('neopixel', '1.0.0').resolves();
		const neopixelLatest = {
			name: 'neopixel',
			version: '1.0.0',
		};
		apiClient.library.withArgs('neopixel', { version: 'latest' }).resolves(neopixelLatest);

		const sut = new LibraryAddCommand();

		return sut.run({}, testSite)
			.then(() => {
				const expectedDependency = /dependencies.neopixel=1\.0\.0/;
				const savedProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');
				expect(savedProperties).to.match(expectedDependency);
			})
	});
});
