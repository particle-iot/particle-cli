const os = require('os');
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const func = require('./function');


describe('Function Command-Line Interface', () => {
	const termWidth = null; // don't right-align option type labels so testing is easier
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		func({ root, commandProcessor });
	});

	describe('Top-Level `function` Namespace', () => {
		it('Handles `function` command', () => {
			const argv = commandProcessor.parse(root, ['function']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['function', '--help']);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Call functions on your device',
					'Usage: particle function <command>',
					'Help:  particle help function <command>',
					'',
					'Commands:',
					'  list  Show functions provided by your device(s)',
					'  call  Call a particular function on a device',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `function list` Namespace', () => {
		it('Handles `list` command', () => {
			const argv = commandProcessor.parse(root, ['function', 'list']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
		});

		it('Includes help', () => {
			commandProcessor.parse(root, ['function', 'list', '--help']);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Show functions provided by your device(s)',
					'Usage: particle function list [options]',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `function call` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['function', 'call', 'my-device', 'my-fn']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', function: 'my-fn', argument: undefined });
			expect(argv.product).to.equal(undefined);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['function', 'call', 'my-device', 'my-fn', 'my-fn-arg']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', function: 'my-fn', argument: 'my-fn-arg' });
			expect(argv.product).to.equal(undefined);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['function', 'call', 'my-device', 'my-fn', 'my-fn-arg', '--product', '12345']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', function: 'my-fn', argument: 'my-fn-arg' });
			expect(argv.product).to.equal('12345');
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['function', 'call']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'device\' is required.');
			expect(argv.clierror).to.have.property('data', 'device');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Errors when required `function` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['function', 'call', 'my-device']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'function\' is required.');
			expect(argv.clierror).to.have.property('data', 'function');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({ device: 'my-device' });
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['function', 'call', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Call a particular function on a device',
					'Usage: particle function call [options] <device> <function> [argument]',
					'',
					'Options:',
					'  --product  Target a device within the given Product ID or Slug  [string]',
					'',
					'Examples:',
					'  particle function call coffee brew                                    Call the `brew` function on the `coffee` device',
					'  particle function call board digitalWrite D7=HIGH                     Call the `digitalWrite` function with argument `D7=HIGH` on the `board` device',
					'  particle function call 0123456789abcdef01234567 brew --product 12345  Call the `brew` function on the device with id `0123456789abcdef01234567` within product `12345`',
					''
				].join(os.EOL));
			});
		});
	});
});

