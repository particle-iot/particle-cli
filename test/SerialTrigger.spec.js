'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var SerialTrigger = require('../lib/SerialTrigger');

function MockPort() {
}
util.inherits(MockPort, EventEmitter);
MockPort.prototype.write = function(data, cb) {
	this.data = data;
	process.nextTick(cb);
};
MockPort.prototype.drain = function(cb) {
	this.emit('drain');
	process.nextTick(cb);
};
MockPort.prototype.flush = function(cb) {
	this.emit('flush');
	process.nextTick(cb);
};

describe('SerialTrigger', function() {
	it('should trigger when prompt is at beginning of line', function(done) {
		var port = new MockPort();
		var st = new SerialTrigger(port);
		st.addTrigger('SSID: ', function() {
			st.stop();
			done();
		});
		st.start();
		port.emit('data', 'SSID: ');
	});

	it('should not trigger when data does not match', function(done) {
		var port = new MockPort();
		var st = new SerialTrigger(port);
		var to = setTimeout(function () {
			done();
		}, 100);
		st.addTrigger('SSID: ', function() {
			clearTimeout(to);
			st.stop();
			done(new Error('triggered when it should not'));
		});
		st.start();
		port.emit('data', 'ASDF: ');
	});

	it('should write the response from the trigger', function(done) {
		var port = new MockPort();
		var st = new SerialTrigger(port);
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
		st.start();
		port.emit('data', 'SSID: ');
	});
});
