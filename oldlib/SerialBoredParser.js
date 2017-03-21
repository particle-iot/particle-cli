'use strict';

var original = {
	setTimeout: global.setTimeout,
	clearTimeout: global.clearTimeout
};

var setTimeoutLocal = function() {
	original.setTimeout.apply(this, arguments);
};

var clearTimeoutLocal = function() {
	original.clearTimeout.apply(this, arguments);
};


/**
 * A parser that waits for a given length of time for a response, or for a given terminator.
 * @type {{makeParser: module.exports.makeParser}}
 */
module.exports = {
	setTimeoutFunctions(setTimeout, clearTimeout) {
		setTimeoutLocal = setTimeout;
		clearTimeoutLocal = clearTimeout;
	},

	makeParser: function (boredDelay, terminator) {
		var boredTimer,
			chunks = [];

		var whenBored = function (emitter) {
			emitter.emit('data', chunks.join(''));
			chunks = [];
		};

		var updateTimer = function (emitter) {
			clearTimeoutLocal(boredTimer);
			boredTimer = setTimeoutLocal(function () {
				whenBored(emitter);
			}, boredDelay);
		};

		var result = function (emitter, buffer) {
			var s = buffer.toString();
			chunks.push(s);

			if (terminator!==undefined && s.indexOf(terminator)>=0) {
				whenBored(emitter);
				clearTimeoutLocal(boredTimer);
				boredTimer = undefined;
			} else {
				updateTimer(emitter);
			}
		};
		return result;
	}
};
