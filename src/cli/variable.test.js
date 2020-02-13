const os = require('os');
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const variable = require('./variable');


describe('Variable Command-Line Interface', () => {
	const termWidth = null; // don't right-align option type labels so testing is easier
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		variable({ root, commandProcessor });
	});

	describe('Top-Level `variable` Namespace', () => {
		it('Handles `variable` command', () => {
			const argv = commandProcessor.parse(root, ['variable']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['variable', '--help']);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Retrieve and monitor variables on your device',
					'Usage: particle variable <command>',
					'Help:  particle help variable <command>',
					'',
					'Commands:',
					'  list     Show variables provided by your device(s)',
					'  get      Retrieve a value from your device',
					'  monitor  Connect and display messages from a device',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `variable list` Namespace', () => {
		it('Handles `list` command', () => {
			const argv = commandProcessor.parse(root, ['variable', 'list']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
		});

		it('Includes help', () => {
			commandProcessor.parse(root, ['variable', 'list', '--help']);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Show variables provided by your device(s)',
					'Usage: particle variable list [options]',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `variable get` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['variable', 'get']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: undefined, variableName: undefined });
			expect(argv.time).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['variable', 'get', 'my-device', 'my-var']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', variableName: 'my-var' });
			expect(argv.time).to.equal(false);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['variable', 'get', 'my-device', 'my-var', '--time']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', variableName: 'my-var' });
			expect(argv.time).to.equal(true);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['variable', 'get', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Retrieve a value from your device',
					'Usage: particle variable get [options] [device] [variableName]',
					'',
					'Options:',
					'  --time     Show the time when the variable was received  [boolean]',
					'  --product  Target a device within the given Product ID or Slug  [string]',
					'',
					'Examples:',
					'  particle variable get basement temperature                  Read the temperature variable from the device basement',
					'  particle variable get basement temperature --product 12345  Read the temperature variable from the device basement within product 12345',
					'  particle variable get all temperature                       Read the temperature variable from all my devices',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `variable monitor` Command', () => {
		// TODO (mirande): seems like a bug - 'device' should probably be required
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['variable', 'monitor']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: undefined, variableName: undefined });
			expect(argv.time).to.equal(false);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['variable', 'monitor', 'my-device', 'my-var']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', variableName: 'my-var' });
			expect(argv.time).to.equal(false);
		});

		it('Parses options flags', () => {
			const argv = commandProcessor.parse(root, ['variable', 'monitor', 'my-device', 'my-var', '--time']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', variableName: 'my-var' });
			expect(argv.time).to.equal(true);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['variable', 'monitor', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Connect and display messages from a device',
					'Usage: particle variable monitor [options] [device] [variableName]',
					'',
					'Options:',
					'  --time   Show the time when the variable was received  [boolean]',
					'  --delay  Interval in milliseconds between variable fetches  [number]',
					'',
					'Examples:',
					'  particle variable monitor up temp --delay 2000  Read the temp variable from the device up every 2 seconds',
					''
				].join(os.EOL));
			});
		});
	});
});

