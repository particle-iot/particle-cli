const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const preprocess = require('./preprocess');


describe('preprocess command-line interface', () => {
	let root;
	beforeEach(() => {
		createApp();
		addCommand();
	});

	function createApp() {
		root = commandProcessor.createAppCategory();
	}

	function addCommand() {
		preprocess({ commandProcessor, root });
	}

	it('parses the arguments', () => {
		const argv = commandProcessor.parse(root, ['preprocess', 'app.ino']);
		expect(argv.clierror).to.be.undefined;
		expect(argv.params).to.have.property('file').equal('app.ino');
	});

	it('fails when file is missing', () => {
		const argv = commandProcessor.parse(root, ['preprocess']);
		expect(argv.clierror).to.have.property('message', 'Parameter \'file\' is required.');
	});

	it('accepts an output file', () => {
		const argv = commandProcessor.parse(root, ['preprocess', 'app.ino', '--saveTo', 'processed.cpp']);
		expect(argv.clierror).to.be.undefined;
		expect(argv).to.have.property('saveTo').equal('processed.cpp');
	});

	it('accepts an input name', () => {
		const argv = commandProcessor.parse(root, ['preprocess', 'app.ino', '--name', 'file.ino']);
		expect(argv.clierror).to.be.undefined;
		expect(argv).to.have.property('name').equal('file.ino');
	});

	it('includes help with examples', () => {
		commandProcessor.parse(root, ['preprocess', '--help']);
		commandProcessor.showHelp((helpText) => {
			expect(helpText).to.include('Preprocess a Wiring file (ino) into a C++ file (cpp)');
			expect(helpText).to.include('particle preprocess app.ino');
			expect(helpText).to.include('particle preprocess - --name app.ino --saveTo -');
		});
	});
});

