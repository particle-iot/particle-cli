module.exports = ({ commandProcessor, root }) => {
	const deviceProtection = commandProcessor.createCategory(root, 'device-protection', 'Manage Device Protection');

	commandProcessor.createCommand(deviceProtection, 'status', 'Gets the current Device Protection status', {
		handler: () => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().getStatus();
		},
		examples: {
			'$0 $command': 'Gets the current Device Protection status'
		}
	});

	commandProcessor.createCommand(deviceProtection, 'disable', 'Disables Device Protection', {

		handler: () => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().disableProtection();
		},
		examples: {
			'$0 $command': 'Puts a Protected Device to Service Mode',
		},
		epilogue: 'A Protected Device in Service Mode allows any command to be performed on it that can be performed on an Open Device like flashing firmware or serial monitor.'
	});

	commandProcessor.createCommand(deviceProtection, 'enable', 'Enables Device Protection', {
		options: {
			file: {
				description: 'File to use for Device Protection'
			}
		},
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().enableProtection(args);
		},
		examples: {
			'$0 $command': 'Turns an Open Device into a Protected Device'
		}
	});

	return deviceProtection;
};

