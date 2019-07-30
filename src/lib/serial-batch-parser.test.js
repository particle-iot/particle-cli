const util = require('util');
const Readable = require('stream').Readable;
const { expect, sinon } = require('../../test/test-setup');
const SerialBatchParser = require('./serial-batch-parser');


function MockStream() {
	Readable.call(this);
}
util.inherits(MockStream, Readable);
MockStream.prototype._read = () => {};

describe('SerialBatchParser', () => {
	it('waits for the timeout and returns the batch of output.', () => {
		var timeout = 50;
		var stream = new MockStream();
		var setTimeout = sinon.stub();
		var clearTimeout = sinon.stub();
		var timer = 'timer';
		var parser = new SerialBatchParser({ timeout });
		parser.setTimeoutFunctions(setTimeout, clearTimeout);
		stream.pipe(parser);

		return Promise.resolve().then(() => {
			setTimeout.returns(timer);
			stream.push('abc');
		}).then(() => {
			expect(clearTimeout).to.have.been.calledWith(null);
			expect(setTimeout).has.been.calledWith(sinon.match.func, timeout);
			expect(parser.read()).to.eq(null);

			setTimeout.reset();
			clearTimeout.reset();

			stream.push('def');
		}).then(() => {
			expect(clearTimeout).to.have.been.calledWith(timer);
			expect(setTimeout).has.been.calledWith(sinon.match.func, timeout);
			expect(parser.read()).to.eq(null);

			// now emulate the passage of time by calling the function passed to setTimeout
			var timeoutFunction = setTimeout.args[0][0];
			setTimeout.reset();
			clearTimeout.reset();

			timeoutFunction();
		}).then(() => {
			expect(clearTimeout).to.have.not.been.called;
			expect(setTimeout).has.not.been.called;
			expect(parser.read().toString()).to.eq('abcdef');
		});
	});
});
