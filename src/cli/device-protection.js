module.exports = ({ commandProcessor, root }) => {
	const deviceProtection = commandProcessor.createCategory(root, 'device-protection', 'Manage device protection');

	commandProcessor.createCommand(deviceProtection, 'status', 'Gets the current device protection status', {
		handler: () => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().getStatus();
		},
		examples: {
			'$0 $command': 'Gets the current device protection status'
		}
	});

	commandProcessor.createCommand(deviceProtection, 'disable', 'Disables device protection', {
		options: {
			'open': {
				boolean: true,
				description: 'Turns a protected device into an open device'
			}
		},
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().disableProtection(args);
		},
		examples: {
			'$0 $command': 'Puts a protected device into service mode',
			'$0 $command --open': 'Turns a protected device into an open device'
		}
	});

	commandProcessor.createCommand(deviceProtection, 'enable', 'Enables device protection', {
		options: {
			file: {
				description: 'File to use for device protection'
			}
		},
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().enableProtection(args);
		},
		examples: {
			'$0 $command': 'Turns an open device into a protected device'
		}
	});

	return deviceProtection;
};

