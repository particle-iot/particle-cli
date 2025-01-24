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

	return tachyon;
};

