'use strict';

var stream = require('stream');
var util = require('util');
var chalk = require('chalk');

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

	error: function() {
		var args = Array.prototype.slice.call(arguments);
		args.unshift(chalk.red('!'));
		console.error.apply(null, args);
	},

	serialInput: function(data) {
		if (!settings.verboseOutput) {
			return;
		}
		var lines = data.split('\n');
		lines.forEach(function (l) {
			if (!l) {
				return;
			}
			console.log(chalk.gray('Serial <-'), l);
		});
	},

	serialOutput: function(data) {
		if (!settings.verboseOutput) {
			return;
		}
		var lines = data.split('\n');
		lines.forEach(function (l) {
			if (!l) {
				return;
			}
			console.log(chalk.gray('Serial ->'), l);
		});
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
