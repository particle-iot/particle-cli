module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'update-cli', 'Update the Particle CLI to the latest version', {
		handler: () => {
			const UpdateCliCommand = require('../cmd/update-cli');
			return new UpdateCliCommand().update();
		}
	});
};

