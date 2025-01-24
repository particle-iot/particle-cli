module.exports = ({ commandProcessor, root }) => {
	const tachyon = commandProcessor.createCategory(root, 'tachyon', 'Setup Particle devices');

	commandProcessor.createCommand(tachyon, 'setup', 'Setup a Tachyon device', {
		handler: () => {
			const SetupTachyonCommands = require('../cmd/setup-tachyon');
			return new SetupTachyonCommands().setup();
		},
		examples: {
			'$0 $command': 'Setup a Tachyon device'
		}
	});

	commandProcessor.createCommand(tachyon, 'download-package', 'Download a Tachyon package', {
		options: {
			region: {
				description: 'Region to download package for',
				type: 'string',
			},
			version: {
				description: 'Version to download package for',
				type: 'string'
			}
		},
		handler: async (args) => {
			const DownloadTachyonPackageCommand = require('../cmd/download-tachyon-package');
			return new DownloadTachyonPackageCommand().download(args);
		},
		examples: {
			'$0 $command --region': 'Download a Tachyon package for the US region and version 1.0.0',
			'$0 $command --region NA --version 1.0.0': 'Download a Tachyon package for the North America region and version 1.0.0'
		}
	});

	return tachyon;
};

