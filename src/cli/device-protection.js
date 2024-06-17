const unindent = require('../lib/unindent');

module.exports = ({ commandProcessor, root }) => {
	const deviceProtection = commandProcessor.createCategory(root, 'device-protection', 'Commands for managing device protection');

	commandProcessor.createCommand(deviceProtection, 'status', 'Gets the current device protection status', {
		handler: () => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().getStatus();
		},
		examples: {
			'$0 $command': 'Gets the current device protection status'
		}
	});

	commandProcessor.createCommand(deviceProtection, 'disable', 'Disables device protection (temporary or permanent)', {
		options: {
			'open': {
				boolean: true,
				description: 'Unlocks a protected device and makes it an Open device'
			}
		},
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands(args).disableProtection(args);
		},
		examples: {
			'$0 $command': 'Device is temporarily unprotected',
			'$0 $command --open': '[TBD] Device becomes an Open device'
		}
	});

	commandProcessor.createCommand(deviceProtection, 'enable', 'Enables device protection', {
		options: {
			file: {
				description: 'Provide file to use for device protection'
			}
		},
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().enableProtection(args);
		},
		examples: {
			'$0 $command': 'Enables device protection temporarily'
		}
	});

	commandProcessor.createCommand(deviceProtection, 'protect', 'Adds device-protection to your bootloader binary', {
		params: '<file>',
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().protectBinary({ file: args.params.file, verbose: true });
		},
		examples: {
			'$0 $command myBootloader.bin': 'Adds device-protection to your bootloader binary'
		}
	});

	return deviceProtection;
};

