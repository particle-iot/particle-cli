const os = require('os');
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const product = require('./product');


describe('Product Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		product({ root, commandProcessor });
	});

	describe('Top-Level `product` Namespace', () => {
		it('Handles `product` command', () => {
			const argv = commandProcessor.parse(root, ['product']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['product', '--help']);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Access Particle Product functionality',
					'Usage: particle product <command>',
					'Help:  particle help product <command>',
					'',
					'Commands:',
					'  device  Manage the devices associated with your product',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `product device` Namespace', () => {
		it('Handles `product` command', () => {
			const argv = commandProcessor.parse(root, ['product', 'device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help with examples', () => {
			commandProcessor.parse(root, ['product', 'device', '--help']);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Manage the devices associated with your product',
					'Usage: particle product device <command>',
					'Help:  particle help product device <command>',
					'',
					'Commands:',
					'  list  List all devices that are part of a product',
					'  add   Adds one or more devices into a Product',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `product device list` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['product', 'device', 'list', '12345']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ product: '12345', device: undefined });
		});

		it('Errors when required arguments are missing', () => {
			const argv = commandProcessor.parse(root, ['product', 'device', 'list']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'product\' is required.');
			expect(argv.clierror).to.have.property('data', 'product');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Includes help with examples', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['product', 'device', 'list', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'List all devices that are part of a product',
					'Usage: particle product device list [options] <product> [device]',
					'',
					'Options:',
					'  --name, -n    Filter to devices with this name (partial matching)  [string]',
					'  --page, -p    Start listing at the given page number  [number]',
					'  --limit, -l   The number of items to show per page  [number]',
					'  --groups, -g  Space separated list of groups to include  [array]',
					'  --json        Output JSON formatted data (experimental)  [boolean]',
					'',
					'Examples:',
					'  particle product device list 12345                           Lists devices in Product 12345',
					'  particle product device list 12345 5a8ef38cb85f8720edce631a  Get details for device 5a8ef38cb85f8720edce631a within in product 12345',
					'  particle product device list 12345 --groups foo bar          Lists devices in Product which are assigned the `foo` or `bar` groups',
					''
				].join(os.EOL));
			});
		});
	});

	describe('Handles `product device add` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['product', 'device', 'add', '12345', '5a8ef38cb85f8720edce631a']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ product: '12345', device: '5a8ef38cb85f8720edce631a' });
		});

		it('Errors when required arguments are missing', () => {
			const argv = commandProcessor.parse(root, ['product', 'device', 'add']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'product\' is required.');
			expect(argv.clierror).to.have.property('data', 'product');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Includes help with examples', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['product', 'device', 'add', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Adds one or more devices into a Product',
					'Usage: particle product device add [options] <product> [device]',
					'',
					'Options:',
					'  --file, -f  Path to single column .txt file with list of IDs, S/Ns, IMEIs, or ICCIDs of the devices to add  [string]',
					'',
					'Examples:',
					'  particle product device add 12345 5a8ef38cb85f8720edce631a         Add device id 5a8ef38cb85f8720edce631a into product 12345',
					'  particle product device add 12345 --file ./path/to/device_ids.txt  Adds a list of devices into product 12345',
					''
				].join(os.EOL));
			});
		});
	});
});

