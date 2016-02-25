import stream from 'stream';
import chalk from 'chalk';

class FilteredLogStream extends stream.Transform {
	constructor() {
		super();
	}

	_transform(data, encoding, callback) {
		if (global.verboseLevel < 1) {
			return callback();
		}
		this.push(data, encoding);
		callback();
	}
}

export default {
	silly() {
		if (global.verboseLevel < 3) {
			return;
		}
		console.log(...arguments);
	},

	verbose() {
		if (global.verboseLevel < 2) {
			return;
		}
		console.log(...arguments);
	},

	debug() {
		if (global.verboseLevel < 1) {
			return;
		}
		console.log(...arguments);
	},

	info() {
		console.log(...arguments);
	},

	warn() {
		console.error(chalk.yellow('!'), ...arguments);
	},

	success() {
		console.log(chalk.green('>'), ...arguments);
	},

	error() {
		console.error(chalk.red('!'), ...arguments);
	},

	fatal() {
		console.error(chalk.red(...arguments));
	},

	serialInput(data) {
		if (global.verboseLevel < 2) {
			return;
		}
		const lines = data.split('\n');
		lines.forEach(l => {
			if (!l) {
				return;
			}
			console.log(chalk.gray('Serial <-'), l);
		});
	},

	serialOutput(data) {
		if (global.verboseLevel < 2) {
			return;
		}
		const lines = data.split('\n');
		lines.forEach(l => {
			if (!l) {
				return;
			}
			console.log(chalk.gray('Serial ->'), l);
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
