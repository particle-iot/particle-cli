const path = require('path');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	PATH_FIXTURES_BINARIES_DIR
} = require('../lib/env');


describe('Binary Commands', () => {
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

	const specs = [
		{
			file: 'core_tinker.bin',
			contents: [
				'core_tinker.bin',
				' CRC is ok (aded513e)',
				' Compiled for core',
				' This is a monolithic firmware number 0 at version 0'
			]
		},
		{
			file: 'photon_tinker.bin',
			contents: [
				'photon_tinker.bin',
				' CRC is ok (ba4f59ab)',
				' Compiled for photon',
				' This is an application module number 1 at version 2',
				' It depends on a system module number 2 at version 1'
			]
		},
		{
			file: 'photon_tinker-0.4.5.bin',
			contents: [
				'photon_tinker-0.4.5.bin',
				' CRC is ok (4a738441)',
				' Compiled for photon',
				' This is an application module number 1 at version 3',
				' It depends on a system module number 2 at version 6'
			]
		},
		{
			file: 'p1_tinker.bin',
			contents: [
				'p1_tinker.bin',
				' CRC is ok (61972e4d)',
				' Compiled for p1',
				' This is an application module number 1 at version 2',
				' It depends on a system module number 2 at version 3'
			]
		},
		{
			file: 'p1_tinker-0.4.5.bin',
			contents: [
				'p1_tinker-0.4.5.bin',
				' CRC is ok (70e7c48c)',
				' Compiled for p1',
				' This is an application module number 1 at version 3',
				' It depends on a system module number 2 at version 6'
			]
		},
		{
			file: 'electron_tinker.bin',
			contents: [
				'electron_tinker.bin',
				' CRC is ok (b3934494)',
				' Compiled for electron',
				' This is an application module number 1 at version 3',
				' It depends on a system module number 2 at version 10'
			]
		},
		{
			file: 'argon_stroby.bin',
			contents: [
				'argon_stroby.bin',
				' CRC is ok (da140931)',
				' Compiled for argon',
				' This is an application module number 1 at version 6',
				' It depends on a system module number 1 at version 1213'
			]
		},
		{
			file: 'boron_blank.bin',
			contents: [
				'boron_blank.bin',
				' CRC is ok (4d02d94f)',
				' Compiled for boron',
				' This is an application module number 1 at version 6',
				' It depends on a system module number 1 at version 1213'
			]
		}
	];

	specs.forEach(spec => {
		const { file, contents } = spec;

		it(`Inspects binary file: ${file}`, async () => {
			const bin = path.join(PATH_FIXTURES_BINARIES_DIR, file);
			const args = ['binary', 'inspect', bin];
			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout.split('\n')).to.include.members(contents);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});
	});
});

