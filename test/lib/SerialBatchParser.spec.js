
var sinon = require('sinon');
var chai = require('chai');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.use(sinonChai);
var expect = chai.expect;

var util = require('util');
var Readable = require('stream').Readable;
var SerialBatchParser = require('../../src/lib/SerialBatchParser');


function MockStream() {
	Readable.call(this);
}
util.inherits(MockStream, Readable);
MockStream.prototype._read = function() {};

describe('SerialBatchParser', function() {
	it('waits for the timeout and returns the batch of output.', function() {
		var timeout = 50;
		var stream = new MockStream();
		var setTimeout = sinon.stub();
		var clearTimeout = sinon.stub();
		var timer = 'timer';
		var parser = new SerialBatchParser({timeout});
		parser.setTimeoutFunctions(setTimeout, clearTimeout);
		stream.pipe(parser);

		return Promise.resolve().then(function() {
			setTimeout.returns(timer);
			stream.push('abc');
		}).then(function() {
			expect(clearTimeout).to.have.been.calledWith(null);
			expect(setTimeout).has.been.calledWith(sinon.match.func, timeout);
			expect(parser.read()).to.eq(null);

			setTimeout.reset();
			clearTimeout.reset();

			stream.push('def');
		}).then(function () {
			expect(clearTimeout).to.have.been.calledWith(timer);
			expect(setTimeout).has.been.calledWith(sinon.match.func, timeout);
			expect(parser.read()).to.eq(null);

			// now emulate the passage of time by calling the function passed to setTimeout
			var timeoutFunction = setTimeout.args[0][0];
			setTimeout.reset();
			clearTimeout.reset();

			timeoutFunction();
		}).then(function() {
			expect(clearTimeout).to.have.not.been.called;
			expect(setTimeout).has.not.been.called;
			expect(parser.read().toString()).to.eq('abcdef');
		});
	});
});
