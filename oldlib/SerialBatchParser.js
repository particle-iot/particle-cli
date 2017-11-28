'use strict';

var util = require('util');
var Transform = require('stream').Transform;
var Buffer = require('safe-buffer').Buffer;
var _ = require('lodash');

/**
 * A parser that waits for a given length of time for a response and emits the batch of
 * data that was received within that time.
 */
function SerialBatchParser(options) {
	options = options || {};
	this.batchTimeout = options.timeout || 250;
	this.batchTimer = null;
	this.buffer = Buffer.alloc(0);
	this.setTimeoutFunctions(global.setTimeout, global.clearTimeout);

	Transform.call(this);
}

util.inherits(SerialBatchParser, Transform);

_.extend(SerialBatchParser.prototype, {
	setTimeoutFunctions: function setTimeoutFunctions(setTimeout, clearTimeout) {
		this.setTimeout = setTimeout;
		this.clearTimeout = clearTimeout;
	},

	_transform: function _transform(chunk, encoding, cb) {
		this.buffer = Buffer.concat([this.buffer, chunk]);
		this.updateTimer();
		cb();
	},

	_flush: function _flush(cb) {
		this.pushBatch();
		cb();
	},

	pushBatch() {
		var batch = this.buffer;
		this.buffer = Buffer.alloc(0);
		this.push(batch);
	},

	updateTimer: function updateTimer() {
		this.clearTimeout(this.batchTimer);
		this.batchTimer = this.setTimeout(
			this.pushBatch.bind(this),
			this.batchTimeout
		);
	},
});

module.exports = SerialBatchParser;
