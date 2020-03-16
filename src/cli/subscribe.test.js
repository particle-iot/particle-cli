const os = require('os');
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const subscribe = require('./subscribe');


describe('Subscribe Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		subscribe({ root, commandProcessor });
	});

	describe('Top-Level `subscribe` Namespace', () => {
		it('Handles `subscribe` command', () => {
			const argv = commandProcessor.parse(root, ['subscribe']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: [] });
			expect(argv.all).to.equal(false);
			expect(argv.device).to.equal(undefined);
			expect(argv.until).to.equal(undefined);
			expect(argv.max).to.equal(undefined);
		});

		it('Parses optional params', () => {
			const argv = commandProcessor.parse(root, ['subscribe', 'test']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: ['test'] });
			expect(argv.all).to.equal(false);
			expect(argv.device).to.equal(undefined);
			expect(argv.until).to.equal(undefined);
			expect(argv.max).to.equal(undefined);
		});

		it('Parses options', () => {
			const args = ['subscribe', 'test', '--all', '--device', 'my-device', '--until', 'my-data', '--max', '3'];
			const argv = commandProcessor.parse(root, args);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ event: ['test'] });
			expect(argv.all).to.equal(true);
			expect(argv.device).to.equal('my-device');
			expect(argv.until).to.equal('my-data');
			expect(argv.max).to.equal(3);
		});

		it('Includes help with examples', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['subscribe', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Listen to device event stream',
					'Usage: particle subscribe [options] [event...]',
					'',
					'Options:',
					'  --all     Listen to all events instead of just those from my devices  [boolean]',
					'  --device  Listen to events from this device only  [string]',
					'  --until   Listen until we see an event exactly matching this data  [string]',
					'  --max     Listen until we see this many events  [number]',
					'',
					'Examples:',
					'  particle subscribe             Subscribe to all event published by my devices',
					'  particle subscribe update      Subscribe to events starting with update from my devices',
					'  particle subscribe --device x  Subscribe to all events published by device x',
					'  particle subscribe --all       Subscribe to public events and all events published by my devices',
					'  particle subscribe --until x   Subscribe to all events and exit when an event has data matching x',
					'  particle subscribe --max x     Subscribe to all events and exit after seeing x events',
					''
				].join(os.EOL));
			});
		});
	});
});

