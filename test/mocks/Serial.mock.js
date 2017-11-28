class MockSerial {
	constructor()
	{
		this._open = false;
		this.listeners = {};
	}

	drain(next) {
		next();
	}

	flush(next) {
		next();
	}

	on(type, cb) {
		this.listeners[type] = cb;
	}

	respond(data) {
		if (this.listeners.data) {
			this.listeners.data(data);
		}
	}

	open(cb) {
		this._open = true;
		cb();
	}

	removeAllListeners(type) {
		this.removeListener(type);
	}

	removeListener(type) {
		delete self.listeners[type];
	}

	get isOpen() {
		return self._open;
	}

	close(cb) {
		self._open = false;
		if (cb) {
			cb();
		}
	}
}

module.exports = MockSerial;
