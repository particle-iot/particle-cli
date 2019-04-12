const settings = require('../../settings');

function logCommand() {
	if (!logCommand._instance) {
		const LogCommand = require('../cmd/log');
		logCommand._instance = new LogCommand(settings);
	}
	return logCommand._instance;
}

module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'log', 'Display log messages from a device', {
		params: '<device> [stream] [serial_port]',
		options: {
			'level': {
				description: 'Default logging level',
				string: true,
				alias: 'l'
			},
			'filter': {
				description: 'Category filter',
				string: true,
				alias: 'f'
			},
			'baud': {
				description: 'Baud rate',
				number: true,
				alias: 'b'
			},
			'raw': {
				description: 'Display raw logging output',
				boolean: true
			}
		},
		examples: {
			'$0 $command my_device': 'Start reading and displaying log messages from the device "my_device"',
			'$0 $command my_device -l none -f app:all': 'Show only application messages',
			'$0 $command my_device -l warn -f app:all': 'Show all application messages as well as system warnings and errors',
			'$0 $command my_device Serial1': 'Use the hardware serial interface for logging'
		},
		handler: (args) => {
			return logCommand().run(args);
		}
	});
};
