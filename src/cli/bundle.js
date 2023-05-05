module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'bundle', 'Prints the assets given to the cli', {
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
		epilogue: 'Creates a bundle of the application binary and assets.'
	});
};
