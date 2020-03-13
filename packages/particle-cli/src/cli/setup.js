module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'setup', 'Do the initial setup & claiming of your device', {
		options: {
			'wifi': {
				boolean: true,
				description: 'Force setup over WiFi even if a device is connected to USB'
			},
			'scan': {
				boolean: true,
				description: 'Force WiFi scanning'
			},
			'manual': {
				boolean: true,
				description: 'Force no WiFi scannign'
			},
			'yes': {
				boolean: true,
				description: 'Answer yes to all questions'
			},
		},
		handler: (args) => {
			const SetupCommand = require('../cmd/setup');
			return new SetupCommand().setup(args);
		}
	});
};

