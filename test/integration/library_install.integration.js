const mockfs = require('mock-fs');
const settings = require('../../settings');
const { expect } = require('../setup');
const commandProcessor = require('../../src/app/command-processor');
const { itHasAccessToken, fetchAccessToken } = require('./access_token');


describe('library install', () => {
	let token;

	beforeEach(() => {
		token = settings.access_token;
		settings.access_token = fetchAccessToken();
		mockfs();
	});

	afterEach((done) => {
		settings.access_token = token;
		console.log('restore fs');
		mockfs.restore();
		done();
	});

	itHasAccessToken('can install a vendored library in an extended application project', function test() {
		this.timeout(20*1000);
		const fs = require('fs');
		fs.mkdirSync('project');
		process.chdir('./project');
		fs.writeFileSync('project.properties', '');
		fs.mkdirSync('src');


		const libraryInstall = require('../../src/cli/library_install');

		const root = commandProcessor.createAppCategory();
		const lib = commandProcessor.createCategory(root, 'library');
		libraryInstall({ commandProcessor, lib });
		const argv = commandProcessor.parse(root, ['library', 'install', '--vendored', 'neopixel']);
		expect(argv.clicommand).to.be.ok;

		const result = argv.clicommand.exec(argv).then(() => {
			[
				'lib/neopixel/library.properties',
				'lib/neopixel/src/neopixel.cpp',
				'lib/neopixel/src/neopixel.h',
				'./lib/neopixel/examples/rgbw-strandtest/rgbw-strandtest.cpp'
			].forEach(filename => {
				expect(fs.statSync(filename).isFile()).to.be.true;
			});
		});
		return expect(result).to.eventually.be.fulfilled;
	});
});

