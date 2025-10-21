'use strict';
const { expect } = require('../setup');
const fs = require('fs-extra');
const path = require('path');
const libraryCommands = require('../../src/cli/library');
const commandProcessor = require('../../src/app/command-processor');
const { PATH_TMP_DIR } = require('../lib/env');
const { delay } = require('../lib/mocha-utils');

describe('library init', () => {

	after(async () => {
		await fs.remove(path.join(PATH_TMP_DIR, 'lib'));
	});

	it('can run library init without prompts', async function libraryCreate(){
		this.timeout(18 * 1000);
		const root = commandProcessor.createAppCategory();

		libraryCommands({ commandProcessor, root });

		await fs.ensureDir(path.join(PATH_TMP_DIR, 'lib'));
		const argv = commandProcessor.parse(root, ['library', 'create', '--name', 'foobar',
			'--version=1.2.3', '--author=mrbig', '--dir', path.join(PATH_TMP_DIR, 'lib')]);

		expect(argv.clicommand).to.be.ok;

		await argv.clicommand.exec(argv);
		await delay(1000); // wait for the generator to finish
		expect(fs.existsSync(path.join(PATH_TMP_DIR, 'lib', 'library.properties'))).to.equal(true);
		expect(fs.existsSync(path.join(PATH_TMP_DIR, 'lib','src', 'foobar.cpp'))).to.equal(true);
		expect(fs.existsSync(path.join(PATH_TMP_DIR, 'lib', 'src', 'foobar.h'))).to.equal(true);
	});
});

