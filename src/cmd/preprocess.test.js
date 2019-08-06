const fs = require('fs');
const path = require('path');
const stream = require('stream');
const wiringPreprocessor = require('wiring-preprocessor');
const { expect, sinon } = require('../../test/setup');
const PreprocessCommand = require('./preprocess');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'test', '__fixtures__');


describe('Preprocess Command', () => {
	let sandbox;
	let command;
	let stdin, stdout;

	beforeEach(() => {
		sandbox = sinon.createSandbox();
		stdin = new stream.Readable();
		stdout = new stream.Writable({
			write: function write(chunk, encoding, callback){
				this.content = (this.content || '') + chunk;
				callback();
			}
		});

		command = new PreprocessCommand({ stdin, stdout });
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('outputFilename', () => {
		it('defaults to standard output when the input is standard input', () => {
			const output = command.outputFilename('-');
			expect(output).to.eql('-');
		});

		it('transforms a relative input file name to cpp', () => {
			const output = command.outputFilename('app.ino');
			expect(output).to.eql('app.cpp');
		});

		it('transforms an absolute input file name to cpp', () => {
			const output = command.outputFilename('/home/user/app.ino');
			expect(output).to.eql('/home/user/app.cpp');
		});
	});

	describe('preprocess', () => {
		let cwd;

		beforeEach(() => {
			cwd = process.cwd();
		});

		afterEach(() => {
			process.chdir(cwd);
		});

		it('preprocesses from standard input and writes to standard output', () => {
			stdin.push('ino file\n');
			stdin.push(null);

			const mock = sandbox.mock(wiringPreprocessor).expects('processFile').withExactArgs('stdin', 'ino file\n').returns('cpp file\n');

			return command.preprocess('-').then(() => {
				expect(stdout.content).to.eql('cpp file\n');

				mock.verify();
			});
		});

		it('preprocesses from a file and write to another file', () => {
			process.chdir(path.join(FIXTURES_DIR, 'wiring', 'one'));

			const mock = sandbox.mock(wiringPreprocessor).expects('processFile').withExactArgs('app.ino', 'ino file\n').returns('cpp file\n');

			return command.preprocess('input.ino', { saveTo: 'output.cpp', name: 'app.ino' }).then(() => {
				const output = fs.readFileSync('output.cpp', 'utf8');
				expect(output).to.eql('cpp file\n');

				mock.verify();
			});
		});

		it('preprocesses large files', () => {
			process.chdir(path.join(FIXTURES_DIR, 'wiring', 'two'));
			const input = fs.readFileSync('input.ino', 'utf8');
			const mock = sandbox.mock(wiringPreprocessor).expects('processFile').withExactArgs('app.ino', input).returns('ok\n');

			return command.preprocess('input.ino', { saveTo: 'output.cpp', name: 'app.ino' }).then(() => {
				const output = fs.readFileSync('output.cpp', 'utf8');
				expect(output).to.eql('ok\n');

				mock.verify();
			});
		});
	});
});

