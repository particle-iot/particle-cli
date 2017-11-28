'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');
var log = require('./log');

function SerialTrigger(port, stream) {
	this.port = port;
	this.stream = stream;
	this.triggers = {};
}
util.inherits(SerialTrigger, EventEmitter);

SerialTrigger.prototype.addTrigger = function(prompt, next) {
	if (!prompt) {
		throw new Error('prompt must be specified');
	}
	this.triggers[prompt] = next;
	this.data = '';
};

/**
 * There is no guarantee that 'data' events contain all of the data emitted by the device
 * in one block, so we have to match on substrings.
 * @param noLogs
 */
SerialTrigger.prototype.start = function(noLogs) {

	var serialDataCallback = function (dataBuffer) {
		var self = this;
		var data = dataBuffer.toString();
		this.data += data;
		var substring = this.data;
		var substringMatch = '';
		var matchPrompt = '';

		while (!matchPrompt && substring) {
			(function(substring) {
				_.forOwn(self.triggers, function (fn, prompt) {
					if (substring.length > prompt.length) {
						if (substring.startsWith(prompt)) {
							matchPrompt = prompt;
							return false;   // quit iteration
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

			var triggerFn = this.triggers[matchPrompt];
			if (triggerFn) {
				triggerFn(function (response, cb) {
					if (response) {
						self.port.flush(function () {
							self.port.write(response);
							self.port.drain(function () {
								if (!noLogs) {
									log.serialInput(response);
								}
								if (cb) {
									cb();
								}
							});
						});
					}
				});
			}
		}
	};
	this.dataCallback = serialDataCallback.bind(this);
	this.stream.on('data', this.dataCallback);
};

SerialTrigger.prototype.stop = function() {
	if (this.dataCallback) {
		this.stream.removeListener('data', this.dataCallback);
		this.dataCallback = null;
	}
};

module.exports = SerialTrigger;
