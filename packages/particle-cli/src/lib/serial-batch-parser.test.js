const util = require('util');
const Readable = require('stream').Readable;
const { expect, sinon } = require('../../test/setup');
const SerialBatchParser = require('./serial-batch-parser');


describe('SerialBatchParser', () => {
	const sandbox = sinon.createSandbox();
	let fakes;

	beforeEach(() => {
		fakes = {
			setTimeout: () => {},
			clearTimeout: () => {}
		};
		sandbox.stub(fakes, 'setTimeout');
		sandbox.stub(fakes, 'clearTimeout');
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('waits for the timeout and returns the batch of output.', async () => {
		const timeout = 50;
		const timer = 'timer';
		const stream = createMockStream();
		const parser = new SerialBatchParser({ timeout });

		parser.setTimeoutFunctions(fakes.setTimeout, fakes.clearTimeout);
		fakes.setTimeout.returns(timer);
		stream.pipe(parser);
		stream.push('abc');

		await Promise.resolve(); // wait a tic

		expect(fakes.clearTimeout).to.have.been.calledWith(null);
		expect(fakes.setTimeout).has.been.calledWith(sinon.match.func, timeout);
		expect(parser.read()).to.eq(null);

		fakes.setTimeout.reset();
		fakes.clearTimeout.reset();
		stream.push('def');

		await Promise.resolve(); // wait a tic

		expect(fakes.clearTimeout).to.have.been.calledWith(timer);
		expect(fakes.setTimeout).has.been.calledWith(sinon.match.func, timeout);
		expect(parser.read()).to.equal(null);

		// now emulate the passage of time by calling the function passed to setTimeout
		const timeoutCallback = fakes.setTimeout.args[0][0];
		fakes.setTimeout.reset();
		fakes.clearTimeout.reset();

		timeoutCallback();

		expect(fakes.clearTimeout).to.have.not.been.called;
		expect(fakes.setTimeout).has.not.been.called;
		expect(parser.read().toString()).to.eq('abcdef');
	});

	function createMockStream(){
		function MockStream(){
			Readable.call(this);
		}
		util.inherits(MockStream, Readable);
		MockStream.prototype._read = () => {};
		return new MockStream();
	}
});

