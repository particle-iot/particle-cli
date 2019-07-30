const path = require('path');
const { expect } = require('../test-setup');
const cli = require('../__lib__/cli');
const fs = require('../__lib__/fs');
const {
	PATH_REPO_DIR
} = require('../__lib__/env');


describe('Binary Command', () => {
	const binPath = path.join(PATH_REPO_DIR, 'assets', 'binaries', 'p1_doctor.bin');
	const help = [
		'Inspect binaries',
		'Usage: particle binary <command>',
		'Help:  particle help binary <command>',
		'',
		'Commands:',
		'  inspect  Describe binary contents',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]'
	];

	before(async () => {
		if (!await fs.pathExists(binPath)){
			throw new Error(`Required binary file is missing! ${binPath}`);
		}
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'binary']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('binary');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['binary', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Inspects a binary file', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['binary', 'inspect', binPath]);
		const binContents = [
			'p1_doctor.bin',
			' CRC is ok (f971a904)',
			' Compiled for p1',
			' This is an application module number 1 at version 4',
			' It depends on a system module number 2 at version 108'
		];

		expect(stdout.split('\n')).to.include.members(binContents);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

