const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const bundle = require('./bundle');

const helpCommandOutput = [
	'Creates a bundle of application binary and assets',
	'Usage: particle bundle [options] <appBinary>',
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


describe('Bundle Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		bundle({ root, commandProcessor });
	});

	describe('Top-Level `bundle` Namespace', () => {
		it('Handles `bundle` command', () => {
			const argv = commandProcessor.parse(root, ['bundle', 'app.bin']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params.appBinary).to.equal('app.bin');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['bundle', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal(helpCommandOutput);
			});
		});
	});
});
