const { expect } = require('../setup');
const path = require('path');
const cli = require('../lib/cli');
const {
	PATH_FIXTURES_THIRDPARTY_OTA_DIR
} = require('../lib/env');

const helpCommandOutput = [
	'Creates a bundle of application binary and assets',
	'Usage: particle bundle [options] <appBinary>',
	'',
	'Global Options:',
	'  -v, --verbose  Increases how much logging to display  [count]',
	'  -q, --quiet    Decreases how much logging to display  [count]',
	'',
	'Options:',
	'  --saveTo  Specify the filename for the compiled binary  [string]',
	'  --assets  Optional. Specify the assets directory using --assets /path/to/assets or --assets /path/to/project.properties. If not specified, assets are obtained from the assetOtaDir property in the project.properties file  [string]',
	'',
	'Examples:',
	'  particle bundle myApp.bin                                       Creates a bundle of application binary and assets. The assets are obtained from the project.properties in the current directory',
	'  particle bundle myApp.bin --assets /path/to/assets              Creates a bundle of application binary and assets. The assets are obtained from /path/to/assets directory',
	'  particle bundle myApp.bin --assets /path/to/project.properties  Creates a bundle of application binary and assets. The assets are picked up from the provided project.properties file',
	'  particle bundle myApp.bin --assets /path/ --saveTo myApp.zip    Creates a bundle of application binary and assets, and saves it to the myApp.zip file',
	'  particle bundle myApp.bin --saveTo myApp.zip                    Creates a bundle of application binary and assets as specified in the assetOtaDir if available, and saves the bundle to the myApp.zip file',
	'',
	'Add assetOtaDir=assets to your project.properties file to bundle assets from the asset directory. The assets path should be relative to the project root.',
	''
].join('\n');

describe('Bundle Commands', () => {
	it('shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['bundle', '--help']);
		expect(stdout).to.equal('');
		expect(stderr).to.eq(helpCommandOutput);
		expect(exitCode).to.equal(0);
	}).timeout(3000);

	it('creates a bundle with name specified by user', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/otaAssets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath, '--saveTo', 'bundle.zip']);

		expect(stdout).to.include(`Bundling ${binPath} with ${assetsPath}:`);
		expect(stdout).to.include('cat.txt', 'house.txt', 'water.txt');
		expect(stdout).to.include('Bundling successful.\nSaved bundle to: bundle.zip');
		expect(stderr).to.eq('');
		expect(exitCode).to.equal(0);
	}).timeout(3000);

	it('creates a bundle with default name', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/otaAssets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath]);

		expect(stdout).to.include(`Bundling ${binPath} with ${assetsPath}:`);
		expect(stdout).to.include('cat.txt', 'house.txt', 'water.txt');
		expect(stdout).to.include('Bundling successful.');
		expect(stdout).to.match(/Saved bundle to: bundle_app_\d+\.zip/);

		expect(stderr).to.eq('');
		expect(exitCode).to.equal(0);
	});

	it('Returns error if app binary is not specified', async () => {
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/otaAssets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', '--assets', assetsPath]);

		expect(stdout).to.include('Parameter \'appBinary\' is required.');
		expect(stderr).to.equal(helpCommandOutput);
		expect(exitCode).to.equal(1);
	});

	it('Returns error if app binary does not exist', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/fake_app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/otaAssets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath]);

		expect(stdout).to.include(`The file ${binPath} does not exist`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('returns error if assets directory does not exist', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/invalid_no_assets/app.bin';
		const assetsPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/invalid_no_assets/assets';
		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath, '--assets', assetsPath]);

		expect(stdout).to.include(`The assets dir ${assetsPath} does not exist`);
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	it('uses assets from project.properties if assets option does not exist', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid/app.bin';
		const cwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid');
		const assetsPath = path.join(cwd, 'otaAssets');

		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath], { cwd });

		expect(stdout).to.include(`Bundling ${binPath} with ${assetsPath}:`);
		expect(stdout).to.include('cat.txt', 'house.txt', 'water.txt');
		expect(stdout).to.include('Bundling successful.');
		expect(stdout).to.match(/Saved bundle to: bundle_app_\d+\.zip/);

		expect(stderr).to.eq('');
		expect(exitCode).to.equal(0);
	});

	it('returns error if project.properties does not have the property for assets', async () => {
		const binPath = PATH_FIXTURES_THIRDPARTY_OTA_DIR + '/valid-no-prop/app.bin';
		const cwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid-no-prop');

		const { stdout, stderr, exitCode } = await cli.run(['bundle', binPath], { cwd });

		expect(stdout).to.include('Add assetOtaDir to your project.properties in order to bundle assets');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});
});
