module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'setup', 'NOT SUPPORTED. Go to setup.particle.io with your browser', {
		handler: (args) => {
			const SetupCommand = require('../cmd/setup');
			return new SetupCommand().setup(args);
		}
	});
};