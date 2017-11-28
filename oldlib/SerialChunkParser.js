'use strict';

var util = require('util');
var Transform = require('stream').Transform;
var Buffer = require('safe-buffer').Buffer;
var _ = require('lodash');

/**
 * A parser that waits for a given length of time for a response and emits the chunk of
 * data that was received within that time.
 * @type {{makeParser: module.exports.makeParser}}
 */
function SerialChunkParser(options) {
	options = options || {};
	this.chunkDelay = options.timeout || 250;
	this.chunkTimer = null;
	this.buffer = Buffer.alloc(0);
	this.setTimeoutFunctions(global.setTimeout, global.clearTimeout);

	Transform.call(this);
}

util.inherits(SerialChunkParser, Transform);

_.extend(SerialChunkParser.prototype, {
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
		this.push(this.buffer);
		this.buffer = Buffer.alloc(0);
		cb();
	},

	updateTimer: function updateTimer() {
		this.clearTimeout(this.chunkTimer);
		this.chunkTimer = this.setTimeout(function () {
			this.push(this.buffer);
			this.buffer = Buffer.alloc(0);
		}.bind(this), this.chunkDelay);
	},
});

module.exports = SerialChunkParser;
