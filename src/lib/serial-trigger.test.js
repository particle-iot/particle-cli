const util = require('util');
const Transform = require('stream').Transform;
const MockSerial = require('../../test/__mocks__/serial.mock');
const SerialTrigger = require('./serial-trigger');

function PassthroughStream() {
	Transform.call(this);
}
util.inherits(PassthroughStream, Transform);
PassthroughStream.prototype._transform = function _transform(chunk, encoding, cb) {
	this.push(chunk);
	process.nextTick(cb);
};

PassthroughStream.prototype._flush = function _flush(cb) {
	process.nextTick(cb);
};

describe('SerialTrigger', () => {
	it('should trigger when prompt is at beginning of line', (done) => {
		var port = new MockSerial();
		var stream = new PassthroughStream();
		port.pipe(stream);
		var st = new SerialTrigger(port, stream);
		st.addTrigger('SSID: ', () => {
			st.stop();
			done();
		});
		st.start();
		port.push('SSID: ');
	});

	it('should not trigger when data does not match', (done) => {
		var port = new MockSerial();
		var stream = new PassthroughStream();
		port.pipe(stream);
		var st = new SerialTrigger(port, stream);
		var to = setTimeout(() => {
			done();
		}, 100);
		st.addTrigger('SSID: ', () => {
			clearTimeout(to);
			st.stop();
			done(new Error('triggered when it should not'));
		});
		st.start();
		port.push('ASDF: ');
	});

	it('should write the response from the trigger', (done) => {
		var port = new MockSerial();
		var stream = new PassthroughStream();
		port.pipe(stream);
		var st = new SerialTrigger(port, stream);
		port.on('drain', () => {
			if (port.data !== 'particle') {
				return done(new Error('Response data does not match'));
			}
			st.stop();
			port.removeAllListeners();
			done();
		});
		st.addTrigger('SSID: ', (cb) => {
			cb('particle');
		});
		st.start(true);
		port.push('SSID: ');
	});
});

