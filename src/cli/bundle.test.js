const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const bundle = require('./bundle');

const helpCommandOutput = [
	'Creates a bundle of application binary and assets',
	'Usage: particle bundle [options] [appBinary]',
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


describe('Bundle Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		bundle({ root, commandProcessor });
	});

	describe('Top-Level `bundle` Namespace', () => {
		it('Handles `bundle` command', () => {
			const argv = commandProcessor.parse(root, ['bundle']);
			expect(argv.clierror).to.equal(undefined);
			console.log('argv', argv);
			expect(argv.params.appBinary).to.equal(undefined);
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
