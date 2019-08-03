const path = require('path');
const { expect } = require('../test-setup');
const cli = require('../__lib__/cli');
const {
	PATH_TMP_DIR,
	PATH_PROJ_STROBY_INO
} = require('../__lib__/env');


describe('Compile Command', () => {
	const strobyBinPath = path.join(PATH_TMP_DIR, 'photon-stroby-updated.bin');
	const help = [
		'Compile a source file, or directory using the cloud compiler',
		'Usage: particle compile [options] <deviceType> [files...]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --target  The firmware version to compile against. Defaults to latest version, or version on device for cellular.  [string]',
		'  --saveTo  Filename for the compiled binary  [string]',
		'',
		'Examples:',
		'  particle compile photon                                  Compile the source code in the current directory in the cloud for a Photon',
		'  particle compile electron project --saveTo electron.bin  Compile the source code in the project directory in the cloud for a Electron and save it to electron.bin',
		'',
		'Param deviceType can be: core, photon, p1, electron, argon, asom, boron, bsom, xenon, xsom, etc'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
	});

	after(async () => {
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'compile']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run('compile');

		expect(stdout).to.equal('Parameter \'deviceType\' is required.');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(1);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['compile', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Compiles firmware', async () => {
		const args = ['compile', 'argon', PATH_PROJ_STROBY_INO, '--saveTo', strobyBinPath];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const log = [
			'Compiling code for argon',
			'',
			'Including:',
			`    ${PATH_PROJ_STROBY_INO}`,
			'attempting to compile firmware ',
			'', // TODO (mirande): should be 'downloading binary from: /v1/binaries/5d38f108bc91fb000130a3f9' but the hash changes on each run
			`saving to: ${strobyBinPath}`,
			'Memory use: ',
			'   text\t   data\t    bss\t    dec\t    hex\tfilename',
			'   7900\t    112\t   1084\t   9096\t   2388\t/workspace/target/workspace.elf',
			'',
			'Compile succeeded.',
			`Saved firmware to: ${strobyBinPath}`
		];

		expect(stdout.split('\n')).to.include.members(log);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);
	});
});

