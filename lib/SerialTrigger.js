'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var _ = require('lodash');
var log = require('./log');

function SerialTrigger(port) {
	this.port = port;
	this.triggers = {};
}
util.inherits(SerialTrigger, EventEmitter);

SerialTrigger.prototype.addTrigger = function(prompt, next) {
	if (!prompt) {
		throw new Error('prompt must be specified');
	}
	this.triggers[prompt] = next;
};

SerialTrigger.prototype.start = function() {
	var serialDataCallback = function (data) {
		data = data.toString();
		var self = this;
		var triggerFn = _.find(this.triggers, function (fn, prompt) {
			return data.indexOf(prompt) >= 0;
		});

		if (triggerFn) {
			triggerFn(function (response, cb) {
				if (response) {
					self.port.flush(function () {
						self.port.write(response, function() {
							self.port.drain(function () {
								log.serialInput(response);
								if (cb) {
									cb();
								}
							});
						});
					});
				}
			});
		}
	}
	this.dataCallback = serialDataCallback.bind(this);
	this.port.on('data', this.dataCallback);
};

SerialTrigger.prototype.stop = function() {
	if (this.dataCallback) {
		this.port.removeListener('data', this.dataCallback);
		this.dataCallback = null;
	}
};

module.exports = SerialTrigger;