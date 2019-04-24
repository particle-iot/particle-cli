var util = require('util');
var Duplex = require('stream').Duplex;

function MockSerial() {
	Duplex.call(this);
	this.isOpen = false;
	this.data = '';
}
util.inherits(MockSerial, Duplex);

MockSerial.prototype._read = function _read() {
};

MockSerial.prototype.write = function write(chunk) {
	this.data += chunk;
};

MockSerial.prototype.drain = function drain(cb) {
	this.emit('drain');
	process.nextTick(cb);
};

MockSerial.prototype.flush = function flush(cb) {
	this.emit('flush');
	process.nextTick(cb);
};

MockSerial.prototype.open = function open(cb) {
	this.isOpen = true;
	process.nextTick(cb);
};


MockSerial.prototype.close = function close(cb) {
	this.isOpen = false;
	if (cb) {
		process.nextTick(cb);
	}
};

module.exports = MockSerial;
