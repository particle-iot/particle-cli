module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'update-cli', 'Update the Particle CLI to the latest version', {
		options: {
			'enable-updates': {
				boolean: true,
				description: 'Enable automatic update checks'
			},
			'disable-updates': {
				boolean: true,
				description: 'Disable automatic update checks'
			},
		},
		handler: (args) => {
			const UpdateCliCommand = require('../cmd/update-cli');
			return new UpdateCliCommand().update(args);
		}
	});
};

