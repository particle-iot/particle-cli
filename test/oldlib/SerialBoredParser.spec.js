
var MockSerial = require('../mocks/Serial.mock');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var chai = require('chai');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.use(sinonChai);
var expect = chai.expect;

var serialBoredParser = require('../../oldlib/SerialBoredParser');

describe('SerialBoredParser', function() {
	var setTimeout, clearTimeout;

	beforeEach(function () {
		setTimeout = sinon.stub();
		clearTimeout = sinon.stub();
		serialBoredParser.setTimeoutFunctions(setTimeout, clearTimeout);
	});

	describe('terminator', function() {
		it('returns before the timeout when the terminator is seen.', function() {
			var terminator = 'arnie';
			var timeout = 5000;
			var sut = serialBoredParser.makeParser(timeout, terminator);
			var timer = 'timer';
			var emitter = { emit: sinon.stub() };

			setTimeout.returns(timer);
			sut(emitter, 'abc');
			expect(clearTimeout).to.have.been.calledWith(undefined);

			expect(setTimeout).has.been.calledWith(sinon.match.func, timeout);
			expect(emitter.emit).to.have.not.been.called;

			setTimeout.reset();
			clearTimeout.reset();

			sut(emitter, 'def'+terminator);
			expect(emitter.emit).has.been.calledWith('data', 'abcdef'+terminator);
			expect(setTimeout).to.have.not.been.called;
			expect(clearTimeout).to.have.been.calledWith(timer);
		});

		it('waits for the timeout when the terminator is not seen.', function() {
			var timeout = 50;
			var sut = serialBoredParser.makeParser(timeout);
			var terminator = 'arnie';
			var timer = 'timer';
			var emitter = { emit: sinon.stub() };

			setTimeout.returns(timer);
			sut(emitter, 'abc');
			expect(clearTimeout).to.have.been.calledWith(undefined);
			expect(setTimeout).has.been.calledWith(sinon.match.func, timeout);
			expect(emitter.emit).to.have.not.been.called;

			setTimeout.reset();
			clearTimeout.reset();

			sut(emitter, 'def');
			expect(emitter.emit).to.have.not.been.called;
			expect(clearTimeout).to.have.been.calledWith(timer);
			expect(setTimeout).has.been.calledWith(sinon.match.func, timeout);

			// now emulate the passage of time by calling the function passed to setTimeout
			var timeoutFunction = setTimeout.args[0][0];
			setTimeout.reset();
			clearTimeout.reset();

			timeoutFunction();
			expect(emitter.emit).has.been.calledWith('data', 'abcdef');
			expect(clearTimeout).to.have.not.been.called;
			expect(setTimeout).has.not.been.called;
		});

	});
});