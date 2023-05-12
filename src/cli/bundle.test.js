const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const bundle = require('./bundle');


describe('Cloud Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		bundle({ root, commandProcessor });
	});

	describe('Top-Level `bundle` Namespace', () => {
		// it('Handles `bundle` command', () => {
		// 	const argv = commandProcessor.parse(root, ['bundle']);
		// 	expect(argv.clierror).to.equal(undefined);
		// 	expect(argv.params).to.equal(undefined);
		// });

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['bundle', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal(
					'Creates a bundle of application binary and assets.\n' +
					'If --assets option is not specified, the default /assets folder in the current directory is used if available.\n' +
					'Usage: particle bundle [options] <appBinary>\n\nOptions:\n' +
					'  --saveTo  Filename for the compiled binary  [string]\n' +
					'  --assets  The folder path of assets to be bundled  [string]\n\n' +
					'Examples:\n  particle bundle myApp.bin --assets /path/to/assets' +
					'                     Creates a bundle of application binary and assets from the /path/to/assets folder\n' +
					'  particle bundle myApp.bin                                              ' +
					'Creates a bundle of application binary and assets from the default /assets folder in the current directory if available\n' +
					'  particle bundle myApp.bin --assets /path/to/assets --saveTo myApp.zip' +
					'  Creates a bundle of application binary and assets from the /path/to/assets folder and saves it to the myApp.zip file\n' +
					'  particle bundle myApp.bin --saveTo myApp.zip                           ' +
					'Creates a bundle of application binary and assets from the default /assets folder in the current directory if available, and saves the bundle to the myApp.zip file\n'
				);
			});
		});
	});
});
