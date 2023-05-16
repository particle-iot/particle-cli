module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'bundle', 'Creates a bundle of application binary and assets', {
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
			return new BundleCommands().createBundle(args);
		},
		examples: {
			'$0 $command myApp.bin --assets /path/to/assets': 'Creates a bundle of application binary and assets from the /path/to/assets folder',
			'$0 $command myApp.bin': 'Creates a bundle of application binary and assets from the default /assets folder in the current directory if available',
			'$0 $command myApp.bin --assets /path/to/assets --saveTo myApp.zip': 'Creates a bundle of application binary and assets from the /path/to/assets folder and saves it to the myApp.zip file',
			'$0 $command myApp.bin --saveTo myApp.zip': 'Creates a bundle of application binary and assets from the default /assets folder in the current directory if available, and saves the bundle to the myApp.zip file'
		},
		epilogue: 'If --assets option is not specified, the folder named \'assets\' in the current directory is used'
	});
};
