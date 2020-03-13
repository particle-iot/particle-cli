const Transform = require('stream').Transform;
const Buffer = require('safe-buffer').Buffer;


/**
 * A parser that waits for a given length of time for a response and emits the batch of
 * data that was received within that time.
 */
module.exports = class SerialBatchParser extends Transform {
	constructor(options){
		super();
		options = options || {};
		this.batchTimeout = options.timeout || 250;
		this.batchTimer = null;
		this.buffer = Buffer.alloc(0);
		this.setTimeoutFunctions(global.setTimeout, global.clearTimeout);
	}

	setTimeoutFunctions(setTimeout, clearTimeout){
		this.setTimeout = setTimeout;
		this.clearTimeout = clearTimeout;
	}

	_transform(chunk, encoding, cb){
		this.buffer = Buffer.concat([this.buffer, chunk]);
		this.updateTimer();
		cb();
	}

	_flush(cb){
		this.pushBatch();
		cb();
	}

	pushBatch(){
		let batch = this.buffer;
		this.buffer = Buffer.alloc(0);
		this.push(batch);
	}

	updateTimer(){
		this.clearTimeout(this.batchTimer);
		this.batchTimer = this.setTimeout(
			this.pushBatch.bind(this),
			this.batchTimeout
		);
	}
};

