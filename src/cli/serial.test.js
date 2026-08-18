'use strict';
const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const serial = require('./serial');


describe('Serial Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		serial({ root, commandProcessor });
	});

	describe('`serial monitor` Command', () => {
		it('Parses arguments', () => {
			const argv = commandProcessor.parse(root, ['serial', 'monitor']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.follow).to.equal(false);
			expect(argv.timestamp).to.equal(false);
			expect(argv.utc).to.equal(false);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['serial', 'monitor', '--follow', '--timestamp', '--utc', '--port', '/dev/ttyACM0']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.follow).to.equal(true);
			expect(argv.timestamp).to.equal(true);
			expect(argv.utc).to.equal(true);
			expect(argv.port).to.equal('/dev/ttyACM0');
		});
	});
});
