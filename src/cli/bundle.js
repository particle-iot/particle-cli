module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'bundle', 'Creates a bundle of application binary and assets. \nIf --assets option is not specified, the default /assets folder in the current directory is used if available.', {
		params: '<appBinary>',
		options: {
			'saveTo': {
				description: 'Filename for the compiled binary'
			},
			'assets': {
				description: 'The folder path of assets to be bundled'
			}
		},
		handler: (args) => {
			const BundleCommands = require('../cmd/bundle');
			return new BundleCommands(args).createBundle(args);
		},
		examples: {
			'$0 $command appBinary.bin --assets /path/to/assets': 'Creates a bundle of application binary and assets from the /path/to/assets folder',
			'$0 $command appBinary.bin': 'Creates a bundle of application binary and assets from the default /assets folder in the current directory if available',
			'$0 $command appBinary.bin --assets /path/to/assets --saveTo myApp.zip': 'Creates a bundle of application binary and assets from the /path/to/assets folder and saves it to the myApp.zip file',
			'$0 $command appBinary.bin --saveTo myApp.zip': 'Creates a bundle of application binary and assets from the default /assets folder in the current directory if available, and saves the bundle to the myApp.zip file'
		}
	});
};
