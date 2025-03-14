const path = require('path');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const fs = require('fs-extra');
const {
	PATH_FIXTURES_BINARIES_DIR, PATH_FIXTURES_THIRDPARTY_OTA_DIR
} = require('../lib/env');


describe('Binary Commands', () => {
	const help = [
		'Inspect binaries',
		'Usage: particle binary <command>',
		'Help:  particle help binary <command>',
		'',
		'Commands:',
		'  inspect                   Describe binary contents',
		'  enable-device-protection  Create a protected bootloader binary',
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

	describe('Binary Inspect Subcommand', () => {
		const specs = [
			{
				file: 'core_tinker.bin',
				contents: [
					'core_tinker.bin',
					' CRC is ok (aded513e)',
					' Compiled for core',
					' This is a monolithic firmware number 0 at version 0',
					' It has a UUID of d7e7a22d276d68029c05dcf3a4e0157d4c2a6c2e269eb82fa5cb66f2cb5a0697'
				]
			},
			{
				file: 'photon_tinker.bin',
				contents: [
					'photon_tinker.bin',
					' CRC is ok (ba4f59ab)',
					' Compiled for photon',
					' This is an application module number 1 at version 2',
					' It has a UUID of 2ba4e71e840f596b812003882aae7ca6496f1590ca4a049310af76eaf11c943a',
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
					' It has a UUID of b3a6dcd529be70fbe24ee959c7305d58e3bc9a04acdce8f093c7a1f759097d09',
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
					' It has a UUID of 14d591f52cc90d5896b955dff02fb415ee5d3bb86a0b35d13483814f2e6fd26a',
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
					' It has a UUID of e4da2ebfc575b274b77454827dab02799c87ed0342b046877c8052886fa89e08',
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
					' It has a UUID of 6b38bf10be92ba40717e91f2f0b68ba1310a96ca8e61f89f68753b4d06ba84f8',
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
					' It has a UUID of aa2e89710f3fa2a5d4ebe20d5dd542bfc606c7e863f70f4ad61e71c961ab58e6',
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
					' It has a UUID of ea905e4ebacfd74c514e2921306a81c9251c66fb4a9596c7a7bae9c70bed5093',
					' It depends on a system module number 1 at version 1213'
				]
			},
			{
				file: 'product_firmware.bin',
				contents: [
					'product_firmware.bin',
					' CRC is ok (e309c618)',
					' Compiled for electron',
					' This is an application module number 1 at version 6',
					' It has a UUID of 3200f1aa2d533b53d9ea892f97153207daf1dc6a401714ce4e5e9c47a85529ce',
					' It is firmware for product id 8178 at version 13',
					' It depends on a system module number 2 at version 1201'
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

	describe('Binary Inspect Subcommand for Bundle', () => {
		it('Inspect a bundle with assets', async () => {
			const bundle = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle.zip');
			const args = ['binary', 'inspect', bundle];
			const expected = [
				'app.bin',
				' CRC is ok (7fa30408)',
				' Compiled for argon',
				' This is an application module number 2 at version 6',
				' It is firmware for product id 12 at version 3',
				' It depends on a system module number 1 at version 4006',
				'It depends on assets:',
				' cat.txt (hash b0f0d8ff8cc965a7b70b07e0c6b4c028f132597196ae9c70c620cb9e41344106)',
				' house.txt (hash a78fb0e7df9977ffd3102395254ae92dd332b46a616e75ff4701e75f91dd60d3)',
				' water.txt (hash 3b0c25d6b8af66da115b30018ae94fbe3f04ac056fa60d1150131128baf8c591)'
			];

			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout.split('\n')).to.include.members(expected);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Inspect a bundle with assets which do not match the hash', async () => {
			const bundle = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle-asset-hash-no-match.zip');
			const args = ['binary', 'inspect', bundle];
			const expected = [
				'app.bin',
				' CRC is ok (7fa30408)',
				' Compiled for argon',
				' This is an application module number 2 at version 6',
				' It is firmware for product id 12 at version 3',
				' It depends on a system module number 1 at version 4006',
				'It depends on assets:',
				' cat.txt failed (hash should be b0f0d8ff8cc965a7b70b07e0c6b4c028f132597196ae9c70c620cb9e41344106)',
				' house.txt (hash a78fb0e7df9977ffd3102395254ae92dd332b46a616e75ff4701e75f91dd60d3)',
				' water.txt (hash 3b0c25d6b8af66da115b30018ae94fbe3f04ac056fa60d1150131128baf8c591)'
			];

			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout.split('\n')).to.include.members(expected);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Inspects a bundle with missing assets', async () => {
			const bundle = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle-missing-assets.zip');
			const args = ['binary', 'inspect', bundle];
			const expected = [
				'app.bin',
				' CRC is ok (7fa30408)',
				' Compiled for argon',
				' This is an application module number 2 at version 6',
				' It is firmware for product id 12 at version 3',
				' It depends on a system module number 1 at version 4006',
				'It depends on assets:',
				' cat.txt (hash b0f0d8ff8cc965a7b70b07e0c6b4c028f132597196ae9c70c620cb9e41344106)',
				' house.txt (hash a78fb0e7df9977ffd3102395254ae92dd332b46a616e75ff4701e75f91dd60d3)',
				' water.txt failed (hash should be 3b0c25d6b8af66da115b30018ae94fbe3f04ac056fa60d1150131128baf8c591 but is not in the bundle)'
			];

			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout.split('\n')).to.include.members(expected);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('errors for zip bundle without binary file', async () => {
			const bundle = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid-bundle.zip');
			const args = ['binary', 'inspect', bundle];

			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('Could not parse app.txt: Attempt to access memory outside buffer bounds');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});

	});

	describe('Binary Subcommand to created a protected bootloader', () => {
		it('Creates a protected bootloader', async () => {
			try {
				const bootloader = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon-bootloader-610.bin');
				const args = ['binary', 'enable-device-protection', bootloader];
				const { stdout, stderr, exitCode } = await cli.run(args);
				expect(stdout).to.include('argon-bootloader-610-protected.bin');
				expect(stderr).to.equal('');
				expect(exitCode).to.equal(0);
			} finally {
				await fs.remove(path.join(PATH_FIXTURES_BINARIES_DIR, 'argon-bootloader-610-protected.bin'));
			}
		});
	});

	describe('Binary Subcommand to list assets', () => {
		it('Lists assets present in an application binary bundle', async () => {
			const bin = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle.zip');
			const args = ['binary', 'list-assets', bin];
			const expected = [
				'Assets found in bundle.zip:',
				' cat.txt (b0f0d8ff8cc965a7b70b07e0c6b4c028f132597196ae9c70c620cb9e41344106)',
				' house.txt (a78fb0e7df9977ffd3102395254ae92dd332b46a616e75ff4701e75f91dd60d3)',
				' water.txt (3b0c25d6b8af66da115b30018ae94fbe3f04ac056fa60d1150131128baf8c591)'
			];

			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout.split('\n')).to.include.members(expected);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('Lists assets present in an application binary', async () => {
			const bin = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'app-with-assets.bin');
			const args = ['binary', 'list-assets', bin];
			const expected = [
				'Assets found in app-with-assets.bin:',
				' cat.txt (b0f0d8ff8cc965a7b70b07e0c6b4c028f132597196ae9c70c620cb9e41344106)',
				' house.txt (a78fb0e7df9977ffd3102395254ae92dd332b46a616e75ff4701e75f91dd60d3)',
				' water.txt (3b0c25d6b8af66da115b30018ae94fbe3f04ac056fa60d1150131128baf8c591)'
			];

			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout.split('\n')).to.include.members(expected);
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(0);
		});

		it('errors for binary without assets', async () => {
			const bin = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon_stroby.bin');
			const args = ['binary', 'list-assets', bin];

			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('No assets found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});

	describe('Binary Subcommand to strip assets', () => {
		it('Removes assets from application binary', async () => {
			try {
				const bin = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle.zip');
				const args = ['binary', 'strip-assets', bin];
				const { stdout, stderr, exitCode } = await cli.run(args);

				expect(stdout).to.include('Application binary without assets saved to');
				expect(stderr).to.equal('');
				expect(exitCode).to.equal(0);
			} finally {
				await fs.remove(path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle-no-assets.bin'));
			}
		});

		it ('Removes assets from application binary', async () => {
			try {
				const bin = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'app-with-assets.bin');
				const args = ['binary', 'strip-assets', bin];
				const { stdout, stderr, exitCode } = await cli.run(args);

				expect(stdout).to.include('Application binary without assets saved to');
				expect(stderr).to.equal('');
				expect(exitCode).to.equal(0);
			} finally {
				await fs.remove(path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'app-with-assets-no-assets.bin'));
			}
		});

		it('errors for binary without assets', async () => {
			const bin = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon_stroby.bin');
			const args = ['binary', 'strip-assets', bin];

			const { stdout, stderr, exitCode } = await cli.run(args);

			expect(stdout).to.equal('No assets found');
			expect(stderr).to.equal('');
			expect(exitCode).to.equal(1);
		});
	});
});

