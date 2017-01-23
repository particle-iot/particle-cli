
import {expect, td, sinon} from '../test-setup';
import fs from 'fs';
import path from 'path';

import {LibraryAddCommand} from '../../src/cmd';
// FIXME: testdouble.js doesn't work properly with ES6 classes
//const projectProperties = td.replace('../../src/lib/ProjectProperties');
import {LibraryAddCommandSite} from '../../src/cmd';

describe('LibraryAddCommand', () => {

	let mockfs;
	beforeEach((done) => {
		mockfs = require('mock-fs');
		mockfs({});
		done();
	});

	afterEach((done) => {
		console.log('cleanup files **');
		mockfs.restore();
		done();
	});

	it('adds a library to a project', () => {
		const dir = '.';
		fs.writeFileSync(path.join(dir, 'project.properties'), '');
		console.log('created file');
		const testSite = td.object(LibraryAddCommandSite);
		const apiClient = td.object(['library']);
		td.when(testSite.apiClient()).thenReturn(Promise.resolve(apiClient));
		td.when(testSite.projectDir()).thenReturn(dir);
		testSite.fetchingLibrary = function (promise) {
			return promise;
		};
		td.when(testSite.libraryIdent()).thenReturn({ name: 'neopixel' });
		td.when(testSite.addedLibrary('neopixel', '1.0.0')).thenReturn(Promise.resolve());
		const neopixelLatest = {
			name: 'neopixel',
			version: '1.0.0',
		};
		td.when(apiClient.library('neopixel', { version: 'latest' })).thenReturn(Promise.resolve(neopixelLatest));

		const sut = new LibraryAddCommand();

		return sut.run({}, testSite)
			.then(() => {
				console.log('testing files **');
				const expectedDependency = /dependencies.neopixel=1\.0\.0/;
				const savedProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');
				expect(savedProperties).to.match(expectedDependency);
			})
	});
});
