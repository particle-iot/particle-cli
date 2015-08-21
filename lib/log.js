'use strict';

var stream = require('stream');
var util = require('util');

var settings = require('../settings');

function FilteredLogStream(stdioStream) {
	stream.Transform.call(this);
}
util.inherits(FilteredLogStream, stream.Transform);

FilteredLogStream.prototype._transform = function(data, encoding, callback) {
	if (!settings.verboseOutput) {
		return callback();
	}
	this.push(data, encoding);
	callback();
};

module.exports = {
	verbose: function() {
		if (!settings.verboseOutput) {
			return;
		}
		console.log.apply(null, arguments);
	},

	stdout: function () {
		var outStream = new FilteredLogStream();
		outStream.pipe(process.stdout);
		return outStream;
	},
	stderr: function () {
		var errStream = new FilteredLogStream();
		errStream.pipe(process.stderr);
		return errStream;
	}
};
