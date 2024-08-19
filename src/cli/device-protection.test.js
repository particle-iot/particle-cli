const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const deviceProtection = require('./device-protection');

describe('Device Protection Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		deviceProtection({ root, commandProcessor });
	});

	describe('`Device Protection` Namespace', () => {
		it('Handles `device-protection` command', () => {
			const argv = commandProcessor.parse(root, ['device-protection']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['device-protection', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Manage Device Protection',
					'Usage: particle device-protection <command>',
					'Help:  particle help device-protection <command>',
					'',
					'Commands:',
					'  status   Gets the current Device Protection status',
					'  disable  Disables Device Protection',
					'  enable   Enables Device Protection',
					''
				].join('\n'));
			});
		});

		describe('`device-protection status` command', () => {
			it('Handles `status` command', () => {
				const argv = commandProcessor.parse(root, ['device-protection', 'status']);
				expect(argv.clierror).to.equal(undefined);
				expect(argv.params).to.eql({});
			});

			it('Handles `status` command with a device', () => {
				const argv = commandProcessor.parse(root, ['device-protection', 'status', '--device', '0123456789abcdef']);
				expect(argv.clierror).to.equal(undefined);
				expect(argv.device).to.eql('0123456789abcdef');
			});

			it('Includes help', () => {
				const termWidth = null; // don't right-align option type labels so testing is easier
				commandProcessor.parse(root, ['device-protection', 'status', '--help'], termWidth);
				commandProcessor.showHelp((helpText) => {
					expect(helpText).to.equal([
						'Gets the current Device Protection status',
						'Usage: particle device-protection status [options]',
						'',
						'Options:',
						'  --device, -d  Device ID or name  [string]',
						'',
						'Examples:',
						'  particle device-protection status  Gets the current Device Protection status',
						''
					].join('\n'));
				});
			});
		});

		describe('`device-protection disable` command', () => {
			it('Handles `disable` command', () => {
				const argv = commandProcessor.parse(root, ['device-protection', 'disable']);
				expect(argv.clierror).to.equal(undefined);
				expect(argv.device).to.eql(undefined);
			});

			it('Handles `disable` command with a device', () => {
				const argv = commandProcessor.parse(root, ['device-protection', 'disable', '-d', '0123456789abcdef']);
				expect(argv.clierror).to.equal(undefined);
				expect(argv.device).to.eql('0123456789abcdef');
			});

			it('Includes help', () => {
				const termWidth = null; // don't right-align option type labels so testing is easier
				commandProcessor.parse(root, ['device-protection', 'disable', '--help'], termWidth);
				commandProcessor.showHelp((helpText) => {
					expect(helpText).to.equal([
						'Disables Device Protection',
						'Usage: particle device-protection disable [options]',
						'',
						'Options:',
						'  -d, --device  Device ID or name  [string]',
						'',
						'Examples:',
						'  particle device-protection disable  Puts a Protected Device to Service Mode',
						'',
						'A Protected Device in Service Mode allows any command to be performed on it that can be performed on an Open Device like flashing firmware or serial monitor.',
						''
					].join('\n'));
				});
			});
		});

		describe('`device-protection enable` command', () => {
			it('Handles `enable` command', () => {
				const argv = commandProcessor.parse(root, ['device-protection', 'enable']);
				expect(argv.clierror).to.equal(undefined);
				expect(argv.device).to.eql(undefined);
			});

			it('Handles `enable` command with a device', () => {
				const argv = commandProcessor.parse(root, ['device-protection', 'enable', '-d', '0123456789abcdef']);
				expect(argv.clierror).to.equal(undefined);
				expect(argv.device).to.eql('0123456789abcdef');
				expect(argv.file).to.eql(undefined);
			});

			it('Handles `enable` command with a filename', () => {
				const argv = commandProcessor.parse(root, ['device-protection', 'enable', '--file', 'file.txt']);
				expect(argv.clierror).to.equal(undefined);
				expect(argv.device).to.eql(undefined);
				expect(argv.file).to.eql('file.txt');
			});

			it('Handles `enable` command with a device and a filename', () => {
				const argv = commandProcessor.parse(root, ['device-protection', 'enable', '-d', '0123456789abcdef', '--file', 'file.txt']);
				expect(argv.clierror).to.equal(undefined);
				expect(argv.device).to.eql('0123456789abcdef');
				expect(argv.file).to.eql('file.txt');
			});

			it('Includes help', () => {
				const termWidth = null; // don't right-align option type labels so testing is easier
				commandProcessor.parse(root, ['device-protection', 'enable', '--help'], termWidth);
				commandProcessor.showHelp((helpText) => {
					expect(helpText).to.equal([
						'Enables Device Protection',
						'Usage: particle device-protection enable [options]',
						'',
						'Options:',
						'  --file        File to use for Device Protection  [string]',
						'  -d, --device  Device ID or name  [string]',
						'',
						'Examples:',
						'  particle device-protection enable  Turns an Open Device into a Protected Device',
						''
					].join('\n'));
				});
			});
		});
	});
});

