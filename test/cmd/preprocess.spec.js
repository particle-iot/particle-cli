import { sinon, expect } from '../test-setup';
var stream = require('stream');
const wiringPreprocessor = require('wiring-preprocessor');

const PreprocessCommand = require('../../src/cmd/preprocess');

describe('Preprocess Command', () => {
	let sandbox;
	let command;
	let stdin, stdout;
	beforeEach(() => {
		sandbox = sinon.createSandbox();
		stdin = new stream.Readable();
		stdout = new stream.Writable({
			write: function (chunk, encoding, callback) {
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
		it('preprocesses from standard input to standard output', () => {
			stdin.push('ino file');
			stdin.push(null);

			const mock = sandbox.mock(wiringPreprocessor).expects('processFile').withExactArgs('stdin', 'ino file').returns('cpp file');

			return command.preprocess('-').then(() => {
				expect(stdout.content).to.eql('cpp file');

				mock.verify();
			});
		});
	});
});
