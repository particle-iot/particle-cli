const os = require('os');
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const keys = require('./keys');


describe('Keys Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		keys({ root, commandProcessor });
	});

	describe('Top-Level `keys` Namespace', () => {
		it('Handles `keys` command', () => {
			const argv = commandProcessor.parse(root, ['keys']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Manage your device\'s key pair and server public key',
					'Usage: particle keys <command>',
					'Help:  particle help keys <command>',
					'',
					'Commands:',
					'  new       Generate a new set of keys for your device',
					'  load      Load a key saved in a file onto your device',
					'  save      Save a key from your device to a file',
					'  send      Tell a server which key you\'d like to use by sending your public key in PEM format',
					'  doctor    Creates and assigns a new key to your device, and uploads it to the cloud',
					'  server    Switch server public keys.',
					'  address   Read server configured in device server public key',
					'  protocol  Retrieve or change transport protocol the device uses to communicate with the cloud',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`keys new` Namespace', () => {
		it('Handles `new` command', () => {
			const argv = commandProcessor.parse(root, ['keys', 'new']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: undefined });
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['keys', 'new', '/path/to/my-key.pem']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: '/path/to/my-key.pem' });
			expect(argv.protocol).to.equal(undefined);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['keys', 'new', '--protocol', 'udp']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: undefined });
			expect(argv.protocol).to.equal('udp');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', 'new', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Generate a new set of keys for your device',
					'Usage: particle keys new [options] [filename]',
					'',
					'Options:',
					'  --protocol  Communication protocol for the device using the key. tcp or udp  [string]',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`keys claim` Namespace', () => {
		it('Handles `claim` command', () => {
			const argv = commandProcessor.parse(root, ['keys', 'load', '/path/to/my-key.pem']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: '/path/to/my-key.pem' });
		});

		it('Errors when required `deviceID` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['keys', 'load']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'filename\' is required.');
			expect(argv.clierror).to.have.property('data', 'filename');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', 'load', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Load a key saved in a file onto your device',
					'Usage: particle keys load [options] <filename>',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`keys save` Namespace', () => {
		it('Handles `save` command', () => {
			const argv = commandProcessor.parse(root, ['keys', 'save', '/path/to/my-key.pem']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: '/path/to/my-key.pem' });
			expect(argv.force).to.equal(false);
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['keys', 'save']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'filename\' is required.');
			expect(argv.clierror).to.have.property('data', 'filename');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
			expect(argv.force).to.equal(false);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['keys', 'save', '/path/to/my-key.pem', '--force']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: '/path/to/my-key.pem' });
			expect(argv.force).to.equal(true);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', 'save', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Save a key from your device to a file',
					'Usage: particle keys save [options] <filename>',
					'',
					'Options:',
					'  --force   Force overwriting of <filename> if it exists  [boolean] [default: false]',
					'  --device  Device ID of the target device  [string]',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`keys send` Namespace', () => {
		it('Handles `send` command', () => {
			const argv = commandProcessor.parse(root, ['keys', 'send', '1234', '/path/to/my-key.pem']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ deviceID: '1234', filename: '/path/to/my-key.pem' });
			expect(argv.product_id).to.equal(undefined);
		});

		it('Errors when required `deviceID` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['keys', 'send']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'deviceID\' is required.');
			expect(argv.clierror).to.have.property('data', 'deviceID');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
			expect(argv.product_id).to.equal(undefined);
		});

		it('Errors when required `filename` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['keys', 'send', '1234']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'filename\' is required.');
			expect(argv.clierror).to.have.property('data', 'filename');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({ deviceID: '1234' });
			expect(argv.product_id).to.equal(undefined);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['keys', 'send', '1234', '/path/to/my-key.pem', '--product_id', '4321']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ deviceID: '1234', filename: '/path/to/my-key.pem' });
			expect(argv.product_id).to.equal(4321); // TODO (mirande): should be a string
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', 'send', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Tell a server which key you\'d like to use by sending your public key in PEM format',
					'Usage: particle keys send [options] <deviceID> <filename>',
					'',
					'Options:',
					'  --product_id  The product ID to use when provisioning a new device  [number]',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`keys doctor` Namespace', () => {
		it('Handles `doctor` command', () => {
			const argv = commandProcessor.parse(root, ['keys', 'doctor', '1234']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ deviceID: '1234' });
			expect(argv.protocol).to.equal(undefined);
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['keys', 'doctor']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'deviceID\' is required.');
			expect(argv.clierror).to.have.property('data', 'deviceID');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
			expect(argv.protocol).to.equal(undefined);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['keys', 'doctor', '1234', '--protocol', 'udp']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ deviceID: '1234' });
			expect(argv.protocol).to.equal('udp');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', 'doctor', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Creates and assigns a new key to your device, and uploads it to the cloud',
					'Usage: particle keys doctor [options] <deviceID>',
					'',
					'Options:',
					'  --protocol  Communication protocol for the device using the key. tcp or udp  [string]',
					'',
				].join(os.EOL));
			});
		});
	});

	describe('`keys server` Namespace', () => {
		it('Handles `server` command', () => {
			const argv = commandProcessor.parse(root, ['keys', 'server']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: undefined, outputFilename: undefined });
			expect(argv.protocol).to.equal(undefined);
			expect(argv.host).to.equal(undefined);
			expect(argv.port).to.equal(undefined);
			expect(argv.deviceType).to.equal(undefined);
		});

		it('Parses optional params', () => {
			const argv = commandProcessor.parse(root, ['keys', 'server', '/path/to/my-key.pem', '/path/to/output.pem']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: '/path/to/my-key.pem', outputFilename: '/path/to/output.pem' });
			expect(argv.protocol).to.equal(undefined);
			expect(argv.host).to.equal(undefined);
			expect(argv.port).to.equal(undefined);
			expect(argv.deviceType).to.equal(undefined);
		});

		it('Parses options', () => {
			const flags = ['--protocol', 'udp', '--host', 'example.com', '--port', '5050', '--deviceType', 'argon'];
			const argv = commandProcessor.parse(root, ['keys', 'server', ...flags]);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filename: undefined, outputFilename: undefined });
			expect(argv.protocol).to.equal('udp');
			expect(argv.host).to.equal('example.com');
			expect(argv.port).to.equal(5050);
			expect(argv.deviceType).to.equal('argon');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', 'server', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Switch server public keys.',
					'Usage: particle keys server [options] [filename] [outputFilename]',
					'',
					'Options:',
					'  --protocol    Communication protocol for the device using the key. tcp or udp  [string]',
					'  --host        Hostname or IP address of the server to add to the key  [string]',
					'  --port        Port number of the server to add to the key  [number]',
					'  --device      Device ID of the target device  [string]',
					'  --deviceType  Generate key file for the provided device type  [string]',
					'',
					'Defaults to the Particle public cloud or you can provide another key in DER format and the server hostname or IP and port',
					''
				].join(os.EOL));
			});
		});
	});

	describe('`keys address` Namespace', () => {
		it('Handles `address` command', () => {
			const argv = commandProcessor.parse(root, ['keys', 'address']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv.protocol).to.equal(undefined);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['keys', 'address', '--protocol', 'udp']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv.protocol).to.equal('udp');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', 'address', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Read server configured in device server public key',
					'Usage: particle keys address [options]',
					'',
					'Options:',
					'  --protocol  Communication protocol for the device using the key. tcp or udp  [string]',
					'  --device    Device ID of the target device  [string]',
					'',
				].join(os.EOL));
			});
		});
	});

	describe('`keys protocol` Namespace', () => {
		it('Handles `protocol` command', () => {
			const argv = commandProcessor.parse(root, ['keys', 'protocol']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv.protocol).to.equal(undefined);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['keys', 'protocol', '--protocol', 'udp']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv.protocol).to.equal('udp');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['keys', 'protocol', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Retrieve or change transport protocol the device uses to communicate with the cloud',
					'Usage: particle keys protocol [options]',
					'',
					'Options:',
					'  --protocol  Communication protocol for the device using the key. tcp or udp  [string]',
					'',
				].join(os.EOL));
			});
		});
	});
});

