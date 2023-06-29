module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'bundle', 'Creates a bundle of application binary and assets', {
		params: '<appBinary>',
		options: {
			'saveTo': {
				description: 'Specify the filename for the compiled binary'
			},
			'assets': {
				description: 'Optional. Specify the assets directory using --assets /path/to/assets or --assets /path/to/project.properties. If not specified, assets are obtained from the assetOtaDir property in the project.properties file'
			}
		},
		handler: (args) => {
			const BundleCommands = require('../cmd/bundle');
			return new BundleCommands().createBundle(args);
		},
		examples: {
			'$0 $command myApp.bin': 'Creates a bundle of application binary and assets. The assets are obtained from the project.properties in the current directory',
			'$0 $command myApp.bin --assets /path/to/assets': 'Creates a bundle of application binary and assets. The assets are obtained from /path/to/assets directory',
			'$0 $command myApp.bin --assets /path/to/project.properties': 'Creates a bundle of application binary and assets. The assets are picked up from the provided project.properties file',
			'$0 $command myApp.bin --assets /path/ --saveTo myApp.zip': 'Creates a bundle of application binary and assets, and saves it to the myApp.zip file',
			'$0 $command myApp.bin --saveTo myApp.zip': 'Creates a bundle of application binary and assets as specified in the assetOtaDir if available, and saves the bundle to the myApp.zip file'
		},
		epilogue: 'Add assetOtaDir=assets to your project.properties file to bundle assets from the asset directory. The assets path should be relative to the project root.'
	});
};
