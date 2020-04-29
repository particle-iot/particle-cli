const os = require('os');
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const usb = require('./usb');


describe('USB Command-Line Interface', () => {
	const termWidth = null; // don't right-align option type labels so testing is easier
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		usb({ root, commandProcessor });
	});

	describe('Top-Level `usb` Namespace', () => {
		it('Handles `usb` command', () => {
			const argv = commandProcessor.parse(root, ['usb']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Control USB devices',
					'Usage: particle usb <command>',
					'Help:  particle help usb <command>',
					'',
					'Commands:',
					'  list             List the devices connected to the host computer',
					'  start-listening  Put a device into the listening mode',
					'  listen           alias for start-listening',
					'  stop-listening   Make a device exit the listening mode',
					'  safe-mode        Put a device into the safe mode',
					'  dfu              Put a device into the DFU mode',
					'  reset            Reset a device',
					'  setup-done       Set the setup done flag',
					'  configure        Update the system USB configuration',
					'  cloud-status     Check a device\'s cloud connection state',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb list` Namespace', () => {
		it('Handles `list` command', () => {
			const argv = commandProcessor.parse(root, ['usb', 'list']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filter: undefined });
		});

		it('Includes help', () => {
			commandProcessor.parse(root, ['usb', 'list', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'List the devices connected to the host computer',
					'Usage: particle usb list [options] [filter]',
					'',
					'Options:',
					'  --exclude-dfu  Do not list devices which are in DFU mode  [boolean]',
					'  --ids-only     Print only device IDs  [boolean]',
					'',
					'Param filter can be: online, offline, a platform name (photon, electron, etc), a device ID or name',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb start-listening` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'start-listening']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'start-listening', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: ['my-device'] });
			expect(argv.all).to.equal(false);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['usb', 'start-listening', '--all']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(true);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', 'start-listening', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Put a device into the listening mode',
					'Usage: particle usb start-listening [options] [devices...]',
					'',
					'Options:',
					'  --all  Send the command to all devices connected to the host computer  [boolean]',
					'',
					'Examples:',
					'  particle usb start-listening my_device  Put a device named "my_device" into the listening mode',
					'  particle usb start-listening --all      Put all devices connected to the host computer into the listening mode',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb stop-listening` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'stop-listening']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'stop-listening', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: ['my-device'] });
			expect(argv.all).to.equal(false);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['usb', 'stop-listening', '--all']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(true);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', 'stop-listening', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Make a device exit the listening mode',
					'Usage: particle usb stop-listening [options] [devices...]',
					'',
					'Options:',
					'  --all  Send the command to all devices connected to the host computer  [boolean]',
					'',
					'Examples:',
					'  particle usb stop-listening my_device  Make a device named "my_device" exit the listening mode',
					'  particle usb stop-listening --all      Make all devices connected to the host computer exit the listening mode',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb safe-mode` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'safe-mode']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'safe-mode', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: ['my-device'] });
			expect(argv.all).to.equal(false);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['usb', 'safe-mode', '--all']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(true);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', 'safe-mode', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Put a device into the safe mode',
					'Usage: particle usb safe-mode [options] [devices...]',
					'',
					'Options:',
					'  --all  Send the command to all devices connected to the host computer  [boolean]',
					'',
					'Examples:',
					'  particle usb safe-mode my_device  Put a device named "my_device" into the safe mode',
					'  particle usb safe-mode --all      Put all devices connected to the host computer into the safe mode',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb dfu` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'dfu']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'dfu', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: ['my-device'] });
			expect(argv.all).to.equal(false);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['usb', 'dfu', '--all']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(true);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', 'dfu', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Put a device into the DFU mode',
					'Usage: particle usb dfu [options] [devices...]',
					'',
					'Options:',
					'  --all  Send the command to all devices connected to the host computer  [boolean]',
					'',
					'Examples:',
					'  particle usb dfu my_device  Put a device named "my_device" into the DFU mode',
					'  particle usb dfu --all      Put all devices connected to the host computer into the DFU mode',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb reset` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'reset']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'reset', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: ['my-device'] });
			expect(argv.all).to.equal(false);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['usb', 'reset', '--all']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(true);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', 'reset', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Reset a device',
					'Usage: particle usb reset [options] [devices...]',
					'',
					'Options:',
					'  --all  Send the command to all devices connected to the host computer  [boolean]',
					'',
					'Examples:',
					'  particle usb reset my_device  Reset a device named "my_device"',
					'  particle usb reset --all      Reset all devices connected to the host computer',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb setup-done` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'setup-done']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(false);
			expect(argv.reset).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'setup-done', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: ['my-device'] });
			expect(argv.all).to.equal(false);
			expect(argv.reset).to.equal(false);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['usb', 'setup-done', '--all', '--reset']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ devices: [] });
			expect(argv.all).to.equal(true);
			expect(argv.reset).to.equal(true);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', 'setup-done', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Set the setup done flag',
					'Usage: particle usb setup-done [options] [devices...]',
					'',
					'Options:',
					'  --reset  Clear the setup done flag  [boolean]',
					'  --all    Send the command to all devices connected to the host computer  [boolean]',
					'',
					'Examples:',
					'  particle usb setup-done my_device          Set the setup done flag on the device "my_device"',
					'  particle usb setup-done --reset my_device  Clear the setup done flag on the device "my_device"',
					'  particle usb setup-done --all              Set the setup done flag on all devices connected to the host computer',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb configure` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'configure']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', 'configure', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Update the system USB configuration',
					'Usage: particle usb configure [options]',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `usb cloud-status` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['usb', 'cloud-status', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device' });
			expect(argv.until).to.equal(undefined);
			expect(argv.timeout).to.equal(60000);
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['usb', 'cloud-status']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'device\' is required.');
			expect(argv.clierror).to.have.property('data', 'device');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
			expect(argv.until).to.equal(undefined);
			expect(argv.timeout).to.equal(60000);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['usb', 'cloud-status', 'my-device', '--until', 'disconnected', '--timeout', '2000']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device' });
			expect(argv.until).to.equal('disconnected');
			expect(argv.timeout).to.equal(2000);
		});

		it('Errors when invalid option value is provided', () => {
			const argv = commandProcessor.parse(root, ['usb', 'cloud-status', 'my-device', '--until', 'NOPE']);
			// TODO (mirande): should this be an error?
			expect(argv.clierror).to.not.be.an.instanceof(Error);
			expect(argv.clierror).to.include('Invalid values:');
			expect(argv.clierror).to.include('Argument: until, Given: "NOPE", Choices: "unknown", "disconnected", "connecting", "connected", "disconnecting"');
			expect(argv.params).to.eql({ device: 'my-device' });
			expect(argv.until).to.equal('NOPE');
			expect(argv.timeout).to.equal(60000);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['usb', 'cloud-status', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Check a device\'s cloud connection state',
					'Usage: particle usb cloud-status [options] <device>',
					'',
					'Options:',
					'  --until    Poll your device for a specific connection state and then exit  [string] [choices: "unknown", "disconnected", "connecting", "connected", "disconnecting"]',
					'  --timeout  How long should polling wait (in ms) for the requested status?  [number] [default: 60000]',
					'',
					'Examples:',
					'  particle usb cloud-status blue                   Check the cloud connection status for the device named `blue`',
					'  particle usb cloud-status red --until connected  Poll cloud connection status for the device named `red` until it reports `connected`',
					''
				].join(os.EOL));
			});
		});
	});
});

