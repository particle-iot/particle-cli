const { expect, sinon } = require('../setup');
const cli = require('../lib/cli');
const {
	PATH_FIXTURES_THIRDPARTY_OTA_DIR
} = require('../lib/env');
const path = require('path');

const helpCommandOutput = [
	'Creates a bundle of application binary and assets',
	'Usage: particle bundle [options] [appBinary]',
	'',
	'Global Options:',
	'  -v, --verbose  Increases how much logging to display  [count]',
	'  -q, --quiet    Decreases how much logging to display  [count]',
	'',
	'Options:',
	'  --saveTo  Filename for the compiled binary  [string]',
	'  --assets  The folder path of assets to be bundled  [string]',
	'',
	'Examples:',
	'  particle bundle myApp.bin --assets /path/to/assets                     Creates a bundle of application binary and assets from the /path/to/assets folder',
	'  particle bundle myApp.bin                                              Creates a bundle of application binary and assets from the default /assets folder in the current directory if available',
	'  particle bundle myApp.bin --assets /path/to/assets --saveTo myApp.zip  Creates a bundle of application binary and assets from the /path/to/assets folder and saves it to the myApp.zip file',
	'  particle bundle myApp.bin --saveTo myApp.zip                           Creates a bundle of application binary and assets from the default /assets folder in the current directory if available, and saves the bundle to the myApp.zip file',
	'',
	'If --assets option is not specified, the folder named \'assets\' in the current directory is used',
	''
].join('\n');

describe('Bundle Commands', () => {
	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['bundle']);

		expect(stdout).to.equal('');
		expect(stderr).to.equal(helpCommandOutput);
		expect(exitCode).to.equal(1);
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['bundle', '--help']);

		expect(stdout).to.equal('');
		expect(stderr).to.eq(helpCommandOutput);
		expect(exitCode).to.equal(0);
	});

	it('Returns bundle created with name specified by the user', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/assets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath, '--saveTo', 'bundle.zip']);

		expect(stdout).to.equal('Success! Created bundle bundle.zip');
		expect(stderr).to.eq('');
		expect(exitCode).to.equal(0);
	});

	it('Returns bundle created with default name', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/assets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath]);

		expect(stdout).to.match(/^Success! Created bundle bundle_app_\d+\.zip$/);
		expect(stderr).to.eq('');
		expect(exitCode).to.equal(0);
	});

	it('Returns error if app binary is not specified', async () => {
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/assets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', '--assets', assetsPath]);

		expect(stdout).to.equal('');
		expect(stderr).to.equal(helpCommandOutput);
		expect(exitCode).to.equal(1);
	});

	it('Returns error if app binary does not exist', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/fake_app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/assets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath]);

		expect(stdout).to.include(`The file ${binPath} does not exist!`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('uses the assets folder in the cwd if --assets option is not provided', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/app.bin';
		const fakeCwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid');
		// Is it possible to inject a fake cwd?
		let cwdStub = sinon.stub(process, 'cwd');
		cwdStub.returns(fakeCwd);

		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath]);

		expect(stdout).to.match(/^Success! Created bundle bundle_app_\d+\.zip$/);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(0);

		cwdStub.restore();
	});

	it('returns error if assets directory does not exist', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/invalid_no_assets/app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/invalid_no_assets/assets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath]);

		expect(stdout).to.include(`The folder ${assetsPath} does not exist!`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('returns error if assets directory exists but is empty', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/invalid_empty_assets/app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/invalid_empty_assets/assets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath]);

		expect(stdout).to.include(`No assets found in ${assetsPath}`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('returns error if the binary provided is not a valid binary', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/invalid_bin/app.txt';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath]);

		expect(stdout).to.include(`The file ${binPath} is not a valid binary`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});
