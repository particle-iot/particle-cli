const fs = require('fs');
const path = require('path');
const mockfs = require('mock-fs');
const { expect, sinon } = require('../test-setup');
const { LibraryAddCommand, LibraryAddCommandSite } = require('../../src/cmd');


describe('LibraryAddCommand', () => {
	beforeEach((done) => {
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
			});
	});
});

