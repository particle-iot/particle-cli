const _ = require('lodash');
const EventEmitter = require('events').EventEmitter;
const log = require('./log');


module.exports = class SerialTrigger extends EventEmitter {
	constructor(port, stream) {
		super();
		this.port = port;
		this.stream = stream;
		this.triggers = {};
	}

	addTrigger(prompt, next) {
		if (!prompt) {
			throw new Error('prompt must be specified');
		}
		this.triggers[prompt] = next;
		this.data = '';
	}

	/**
	 * There is no guarantee that 'data' events contain all of the data emitted by the device
	 * in one block, so we have to match on substrings.
	 * @param noLogs
	 */
	start(noLogs) {

		let serialDataCallback = (dataBuffer) => {
			let self = this;
			let data = dataBuffer.toString();
			this.data += data;
			let substring = this.data;
			let matchPrompt = '';

			while (!matchPrompt && substring) {
				(function matchSubstring(substring) {
					_.forOwn(self.triggers, (fn, prompt) => {
						if (substring.length > prompt.length) {
							if (substring.startsWith(prompt)) {
								matchPrompt = prompt;
								return false; // quit iteration
							}
						} else {
							if (prompt.startsWith(substring)) {
								matchPrompt = prompt;
								return false;
							}
						}
					});
				})(substring);

				if (!matchPrompt) {
					substring = substring.substring(1);
				}
			}

			this.data = substring;

			if (matchPrompt && substring.length >= matchPrompt.length) {
				this.data = substring.substring(matchPrompt.length);

				let triggerFn = this.triggers[matchPrompt];
				if (triggerFn) {
					triggerFn((response, cb) => {
						if (response) {
							self.port.write(response);
							self.port.drain(() => {
								if (!noLogs) {
									log.serialInput(response);
								}
								if (cb) {
									cb();
								}
							});
						}
					});
				}
			}
		};
		this.dataCallback = serialDataCallback.bind(this);
		this.stream.on('data', this.dataCallback);
	}

	stop() {
		if (this.dataCallback) {
			this.stream.removeListener('data', this.dataCallback);
			this.dataCallback = null;
		}
	}
};

