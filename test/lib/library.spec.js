
import {expect, td} from '../test-setup';

import {LibraryAddCommand} from '../../src/lib/library';
import {CLILibraryAddCommandSite} from '../../src/cmd/library';
// FIXME: testdouble.js doesn't work properly with ES6 classes
//const projectProperties = td.replace('../../src/lib/ProjectProperties');
import getProjectFixture from '../fixtures/projects';


describe('LibraryAddCommand', () => {
	it('adds a library to a project', () => {
		const dir = getProjectFixture('simple');
		const testSite = td.object(CLILibraryAddCommandSite);
		td.when(testSite.projectDir()).thenReturn(dir);

		const apiClient = td.object(['library']);
		const neopixelLatest = {
			name: 'neopixel',
			version: '1.0.0',
		};
		td.when(apiClient.library('neopixel', 'latest')).thenReturn(neopixelLatest);

		const sut = new LibraryAddCommand({ apiClient });
		return sut.run(testSite, { name: 'neopixel' })
			.then(() => {


			})
	});
});