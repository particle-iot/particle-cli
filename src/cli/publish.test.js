'use strict';
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
			expect(argv.product).to.equal(undefined);
			expect(argv.org).to.equal(undefined);
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['publish', 'my-event', 'my-data']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: 'my-event', data: 'my-data' });
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['publish', 'my-event', '--product', '12345']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: 'my-event', data: undefined });
			expect(argv.product).to.equal('12345');
		});

		it('Parses `--org`', () => {
			const argv = commandProcessor.parse(root, ['publish', 'my-event', 'my-data', '--org', 'my-org']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: 'my-event', data: 'my-data' });
			expect(argv.org).to.equal('my-org');
			expect(argv.product).to.equal(undefined);
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['publish']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'event\' is required.');
			expect(argv.clierror).to.have.property('data', 'event');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Throws when option flag is malformed', () => {
			expect(() => commandProcessor.parse(root, ['publish', 'my-event', '--product']))
				.to.throw('Not enough arguments following: product');
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
					'  --product  Publish to the given Product ID or Slug\'s stream  [string]',
					'  --org      Specify the organization slug (e.g. my-org)  [string]',
					'',
					'Examples:',
					'  particle publish temp 25.0                  Publish a temp event to your private event stream',
					'  particle publish temp 25.0 --product 12345  Publish a temp event to your product 12345\'s event stream',
					'  particle publish temp 25.0 --org my-org     Publish a temp event to every product in organization my-org',
					''
				].join('\n'));
			});
		});
	});
});

