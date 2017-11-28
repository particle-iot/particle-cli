var util = require('util');
var Duplex = require('stream').Duplex;

function MockSerial() {
	Duplex.call(this);
	this.isOpen = false;
	this.data = '';
}
util.inherits(MockSerial, Duplex);

MockSerial.prototype._read = function() {
};

MockSerial.prototype.write = function(chunk) {
	this.data += chunk;
};

MockSerial.prototype.drain = function(cb) {
	this.emit('drain');
	process.nextTick(cb);
};

MockSerial.prototype.flush = function(cb) {
	this.emit('flush');
	process.nextTick(cb);
};

MockSerial.prototype.open = function(cb) {
	this.isOpen = true;
	process.nextTick(cb);
};


MockSerial.prototype.close = function(cb) {
	this.isOpen = false;
	if (cb) {
		process.nextTick(cb);
	}
};

module.exports = MockSerial;
