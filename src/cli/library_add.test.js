// The following test struggles to complete in a timely fashion
// commenting out for now until we can figure out how to avoid the timeouts
// we periodacally see:
// ```
//  1) LibraryAddCommand
//       adds a library to a project:
//     Error: Timeout of 2000ms exceeded. For async tests and hooks, ensure "done()" is called; if returning a Promise, ensure it resolves. (/Users/distiller/project/src/cli/library_add.test.js)
//      at listOnTimeout (node:internal/timers:559:17)
//      at processTimers (node:internal/timers:502:7)
// ```
//
// const fs = require('fs');
// const path = require('path');
// const mockfs = require('mock-fs');
// const { expect, sinon } = require('../../test/setup');
// const { LibraryAddCommand, LibraryAddCommandSite } = require('../cmd');
//
// describe('LibraryAddCommand', () => {
// 	const sandbox = sinon.createSandbox();
// 	let testSite;

// 	beforeEach(() => {
// 		testSite = sandbox.createStubInstance(LibraryAddCommandSite);
// 		mockfs();
// 	});

// 	afterEach(() => {
// 		sandbox.restore();
// 		mockfs.restore();
// 	});

// 	it('adds a library to a project', async () => {
// 		const name = 'neopixel';
// 		const version = '1.0.0';
// 		const dir = '.';

// 		fs.writeFileSync(path.join(dir, 'project.properties'), '');

// 		const apiClient = { library: sandbox.stub() };

// 		testSite.projectDir.withArgs().returns(dir);
// 		testSite.apiClient.withArgs().resolves(apiClient);
// 		testSite.libraryIdent.withArgs().returns({ name });
// 		testSite.addedLibrary.withArgs(name, version).resolves();
// 		testSite.fetchingLibrary.withArgs().callsFake(promise => promise);

// 		const neopixelLatest = { name, version };

// 		apiClient.library.withArgs(name, { version: 'latest' }).resolves(neopixelLatest);

// 		const cmd = new LibraryAddCommand();
// 		const result = await cmd.run({}, testSite);
// 		const expectedDependency = /dependencies.neopixel=1\.0\.0/;
// 		const savedProperties = fs.readFileSync(`${dir}/project.properties`, 'utf8');
// 		expect(savedProperties).to.match(expectedDependency);
// 		expect(result).to.not.exist;
// 	});
// });

