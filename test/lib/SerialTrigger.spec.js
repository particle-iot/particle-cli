'use strict';

var util = require('util');
var MockSerial = require('../mocks/Serial.mock')
var Transform = require('stream').Transform;

var SerialTrigger = require('../../src/lib/SerialTrigger');

function PassthroughStream() {
	Transform.call(this);
}
util.inherits(PassthroughStream, Transform);
PassthroughStream.prototype._transform = function(chunk, encoding, cb) {
	this.push(chunk);
	process.nextTick(cb);
};

PassthroughStream.prototype._flush = function(cb) {
	process.nextTick(cb);
};

describe('SerialTrigger', function() {
	it('should trigger when prompt is at beginning of line', function(done) {
		var port = new MockSerial();
		var stream = new PassthroughStream();
		port.pipe(stream);
		var st = new SerialTrigger(port, stream);
		st.addTrigger('SSID: ', function() {
			st.stop();
			done();
		});
		st.start();
		port.push('SSID: ');
	});

	it('should not trigger when data does not match', function(done) {
		var port = new MockSerial();
		var stream = new PassthroughStream();
		port.pipe(stream);
		var st = new SerialTrigger(port, stream);
		var to = setTimeout(function () {
			done();
		}, 100);
		st.addTrigger('SSID: ', function() {
			clearTimeout(to);
			st.stop();
			done(new Error('triggered when it should not'));
		});
		st.start();
		port.push('ASDF: ');
	});

	it('should write the response from the trigger', function(done) {
		var port = new MockSerial();
		var stream = new PassthroughStream();
		port.pipe(stream);
		var st = new SerialTrigger(port, stream);
		port.on('drain', function() {
			if (port.data !== 'particle') {
				return done(new Error('Response data does not match'));
			}
			st.stop();
			port.removeAllListeners();
			done();
		});
		st.addTrigger('SSID: ', function(cb) {
			cb('particle');
		});
		st.start(true);
		port.push('SSID: ');
	});
});
