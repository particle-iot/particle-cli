const path = require('path');
const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	PATH_TMP_DIR,
	PATH_PROJ_STROBY_INO
} = require('../lib/env');


describe('Preprocess Commands', () => {
	const outputCppPath = path.join(PATH_TMP_DIR, 'output.cpp');
	const expectedPrologue = [
		'/******************************************************/',
		'//       THIS IS A GENERATED FILE - DO NOT EDIT       //',
		'/******************************************************/',
		'',
		'#include "application.h"',
		`#line 1 "${PATH_PROJ_STROBY_INO}"`
	];
	const help = [
		'Preprocess a Wiring file (ino) into a C++ file (cpp)',
		'Usage: particle preprocess [options] <file>',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --name    Filename and path to include in the preprocessed file. Default to the input file name  [string]',
		'  --saveTo  Filename for the preprocessed file  [string]',
		'',
		'Examples:',
		'  particle preprocess app.ino                      Preprocess app.ino and save it to app.cpp',
		'  particle preprocess - --name app.ino --saveTo -  Preprocess from standard input and save output to standard output. Useful for scripts'
	];

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'preprocess']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['preprocess', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Preprocesses `.ino` -> `.cpp`', async () => {
		const args = ['preprocess', PATH_PROJ_STROBY_INO, '--saveTo', outputCppPath];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.equal('');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		const cpp = await fs.readFile(outputCppPath, 'utf8');

		expect(cpp.split('\n')).to.include.members(expectedPrologue);
	});

	it('Preprocesses `.ino` -> `.cpp` from stdin', async () => {
		const args = ['preprocess', '-', '--name', PATH_PROJ_STROBY_INO, '--saveTo', '-'];
		const subprocess = cli.run(args);

		await delay(1000);
		subprocess.stdin.write('int version = 42;');
		subprocess.stdin.end('\n');

		const { stdout, stderr, exitCode } = await subprocess;

		expect(stdout.split('\n')).to.include.members(expectedPrologue);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

