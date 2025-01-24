module.exports = ({ commandProcessor, root }) => {
	const setup = commandProcessor.createCategory(root, 'setup', 'Setup Particle devices');

	commandProcessor.createCommand(setup, 'tachyon', 'Setup a Tachyon device', {
		handler: () => {
			const SetupCommands = require('../cmd/setup');
			return new SetupCommands().setupTachyon();
		},
		examples: {
			'$0 $command': 'Setup a Tachyon device'
		}
	});

	return setup;
};

