

const Transform = require('stream').Transform;
const chalk = require('chalk');
const settings = require('../../settings');

class FilteredLogStream extends Transform {
	constructor() {
		super();
	}

	_transform(data, encoding, callback) {
		if (!settings.verboseOutput) {
			return callback();
		}
		this.push(data, encoding);
		callback();
	}
}

module.exports = {
	verbose() {
		if (!settings.verboseOutput) {
			return;
		}
		console.log.apply(null, arguments);
	},

	error() {
		let args = Array.prototype.slice.call(arguments);
		args.unshift(chalk.red('!'));
		console.error.apply(null, args);
	},

	serialInput(data) {
		if (!settings.verboseOutput) {
			return;
		}
		let lines = data.split('\n');
		lines.forEach((l) => {
			if (!l) {
				return;
			}
			console.log(chalk.gray('Serial <-'), l);
		});
	},

	serialOutput(data) {
		if (!settings.verboseOutput) {
			return;
		}
		let lines = data.split('\n');
		lines.forEach((l) => {
			if (!l) {
				return;
			}
			console.log(chalk.gray('Serial ->'), l);
		});
	},

	stdout() {
		let outStream = new FilteredLogStream();
		outStream.pipe(process.stdout);
		return outStream;
	},

	stderr() {
		let errStream = new FilteredLogStream();
		errStream.pipe(process.stderr);
		return errStream;
	}
};
