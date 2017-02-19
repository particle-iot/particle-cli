'use strict';

/**
 * A parser that waits for a given length of time for a response, or for a given terminator.
 * @type {{makeParser: module.exports.makeParser}}
 */
module.exports = {
	makeParser: function (boredDelay, terminator) {
		var boredTimer,
			chunks = [];

		var whenBored = function (emitter) {
			emitter.emit('data', chunks.join(''));
			chunks = [];
		};

		var updateTimer = function (emitter) {
			clearTimeout(boredTimer);
			boredTimer = setTimeout(function () {
				whenBored(emitter);
			}, boredDelay);
		};

		return function (emitter, buffer) {
			var s = buffer.toString();
			chunks.push(s);
			if (terminator!==undefined && s.indexOf(terminator)>=0) {
				whenBored(emitter);
			} else {
				updateTimer(emitter);
			}
		};
	}
};
