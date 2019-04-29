const chalk = require('chalk');
const stream = require('stream');

class FilteredLogStream extends stream.Transform {
	constructor() {
		super();
	}

	_transform(data, encoding, callback) {
		if (global.verboseLevel < 2) {
			return callback();
		}
		this.push(data, encoding);
		callback();
	}
}

module.exports = {
	silly() {
		if (global.verboseLevel < 4) {
			return;
		}
		console.log(...arguments);
	},

	verbose() {
		if (global.verboseLevel < 3) {
			return;
		}
		console.log(...arguments);
	},

	debug() {
		if (global.verboseLevel < 2) {
			return;
		}
		console.log(...arguments);
	},

	info() {
		if (global.verboseLevel < 1) {
			return;
		}
		console.log(...arguments);
	},

	warn() {
		if (global.verboseLevel < 1) {
			return;
		}
		console.error(chalk.yellow('!'), ...arguments);
	},

	success() {
		if (global.verboseLevel < 1) {
			return;
		}
		console.log(chalk.green('>'), ...arguments);
	},

	error() {
		if (global.verboseLevel < 1) {
			return;
		}
		console.error(chalk.red('!'), ...arguments);
	},

	fatal() {
		if (global.verboseLevel < 1) {
			return;
		}
		console.error(chalk.red(...arguments));
	},

	serialInput(data) {
		if (global.verboseLevel < 3) {
			return;
		}
		const lines = data.split('\n');
		lines.forEach(l => {
			if (!l) {
				return;
			}
			console.log(chalk.gray('Serial In <-'), l);
		});
	},

	serialOutput(data) {
		if (global.verboseLevel < 3) {
			return;
		}
		const lines = data.split('\n');
		lines.forEach(l => {
			if (!l) {
				return;
			}
			console.log(chalk.gray('Serial Out ->'), l);
		});
	},

	stdout() {
		const outStream = new FilteredLogStream();
		outStream.pipe(process.stdout);
		return outStream;
	},
	stderr() {
		const errStream = new FilteredLogStream();
		errStream.pipe(process.stderr);
		return errStream;
	}
};

