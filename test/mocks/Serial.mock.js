var extend = require('xtend');


function MockSerial() {
	var self = this;
	self.open = false;
	self.listeners = {};
	return extend(this, {
		drain: function (next) {
			next();
		},
		flush: function (next) {
			next();
		},
		on: function(type, cb) {
			self.listeners[type] = cb;
		},
		respond: function (data) {
			if (self.listeners.data) {
				self.listeners.data(data);
			}
		},
		open: function (cb) {
			self.open = true;
			cb();
		},
		removeAllListeners(type) {
			this.removeListener(type);
		},
		removeListener(type) {
			delete self.listeners[type];
		},
		isOpen: function() {
			return self.open;
		},
		close: function(cb) {
			self.open = false;
			if (cb) {
				cb();
			}
		}
	});
}

module.exports = MockSerial;