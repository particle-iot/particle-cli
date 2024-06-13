const unindent = require('../lib/unindent');

module.exports = ({ commandProcessor, root }) => {
	const deviceProtection = commandProcessor.createCategory(root, 'protection', 'Commands for managing device protection');

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
		params: '[permanent]',
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().disableProtection(args.params);
		},
		examples: {
			'$0 $command': 'Disables device protection temporarily',
			'$0 $command --permanent': 'Disables device protection permanently'
		}
	});

	commandProcessor.createCommand(deviceProtection, 'enable', 'Enables device protection', {
		options: Object.assign({
			'permanent': {
				description: 'Disable device protection permanently'
			},
		}),
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().enableProtection(args);
		},
		examples: {
			'$0 $command': 'Enables device protection temporarily',
			'$0 $command --permanent': 'Disables device protection permanently'
		}
	});

	commandProcessor.createCommand(deviceProtection, 'protect', 'Adds device-protection to your bootloader binary', {
		params: '<file>',
		handler: (args) => {
			const DeviceProtectionCommands = require('../cmd/device-protection');
			return new DeviceProtectionCommands().protectBinary(args.params.file);
		},
		examples: {
			'$0 $command myBootloader.bin': 'Adds device-protection to your bootloader binary'
		}
	});

	return deviceProtection;
};

