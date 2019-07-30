const fs = require('fs');
const path = require('path');
const mockfs = require('mock-fs');
const { expect, sinon } = require('../../test/setup');
const { LibraryAddCommand, LibraryAddCommandSite } = require('../cmd');


describe('LibraryAddCommand', () => {
	const sandbox = sinon.createSandbox();
	let testSite;

	beforeEach(() => {
		testSite = sandbox.createStubInstance(LibraryAddCommandSite);
		mockfs();
	});

	afterEach(() => {
		sandbox.restore();
		mockfs.restore();
	});

	it('adds a library to a project', async () => {
		const name = 'neopixel';
		const version = '1.0.0';
		const dir = '.';

		fs.writeFileSync(path.join(dir, 'project.properties'), '');

		const apiClient = { library: sandbox.stub() };

		testSite.projectDir.withArgs().returns(dir);
		testSite.apiClient.withArgs().resolves(apiClient);
		testSite.libraryIdent.withArgs().returns({ name });
		testSite.addedLibrary.withArgs(name, version).resolves();
		testSite.fetchingLibrary.withArgs().callsFake(promise => promise);

		const neopixelLatest = { name, version };

		apiClient.library.withArgs(name, { version: 'latest' }).resolves(neopixelLatest);

		const cmd = new LibraryAddCommand();
		const result = await cmd.run({}, testSite);
		const expectedDependency = /dependencies.neopixel=1\.0\.0/;
		const savedProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');
		expect(savedProperties).to.match(expectedDependency);
		expect(result).to.not.exist;
	});
});

