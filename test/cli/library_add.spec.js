
import {expect, td, sinon} from '../test-setup';
import fs from 'fs';

import {LibraryAddCommand} from '../../src/cmd/library';
import {CLILibraryAddCommandSite} from '../../src/cli/library';
// FIXME: testdouble.js doesn't work properly with ES6 classes
//const projectProperties = td.replace('../../src/lib/ProjectProperties');
import getProjectFixture from '../fixtures/projects';

describe('LibraryAddCommand', () => {
	it('adds a library to a project', () => {
		const dir = getProjectFixture('simple');
		const testSite = td.object(CLILibraryAddCommandSite);
		td.when(testSite.projectDir()).thenReturn(dir);
		testSite.fetchingLibrary = function (promise) {
			return promise;
		};
		td.when(testSite.libraryIdent()).thenReturn({ name: 'neopixel' });
		td.when(testSite.addedLibrary('neopixel', '1.0.0')).thenReturn(Promise.resolve());

		const apiClient = td.object(['library']);
		const neopixelLatest = {
			name: 'neopixel',
			version: '1.0.0',
		};
		td.when(apiClient.library('neopixel', { version: 'latest' })).thenReturn(Promise.resolve(neopixelLatest));

		const sut = new LibraryAddCommand({ apiClient });
		return sut.run({}, testSite)
			.then(() => {
				const expectedDependency = /dependencies.neopixel=1\.0\.0/;
				const savedProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');
				expect(savedProperties).to.match(expectedDependency);
			})
	});
});
