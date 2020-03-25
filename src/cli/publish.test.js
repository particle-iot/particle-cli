const os = require('os');
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const publish = require('./publish');


describe('Publish Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		publish({ root, commandProcessor });
	});

	describe('Top-Level `publish` Namespace', () => {
		it('Handles `publish` command', () => {
			const argv = commandProcessor.parse(root, ['publish', 'my-event']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: 'my-event', data: undefined });
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['publish', 'my-event', 'my-data']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: 'my-event', data: 'my-data' });
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['publish', 'my-event', '--private', '--public']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: 'my-event', data: undefined });
			expect(argv.private).to.equal(true);
			expect(argv.public).to.equal(true);
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['publish']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'event\' is required.');
			expect(argv.clierror).to.have.property('data', 'event');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Includes help with examples', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['publish', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Publish an event to the cloud',
					'Usage: particle publish [options] <event> [data]',
					'',
					'Options:',
					'  --private  Publish to the private stream  [boolean] [default: true]',
					'  --public   Publish to the public stream  [boolean]',
					'',
					'Examples:',
					'  particle publish temperature 25.0  Publish a temperature event to your private event stream',
					''
				].join(os.EOL));
			});
		});
	});
});

