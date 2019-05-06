const when = require('when');
const inquirer = require('inquirer');
const Handlebars = require('handlebars');
const { Spinner } = require('cli-spinner');
const log = require('../lib/log');
require('./templates');


Spinner.setDefaultSpinnerString(Spinner.spinners[7]);

function prompt(qs) {
	if (!global.isInteractive) {
		return when.reject(new Error('Prompts are not allowed in non-interactive mode'));
	}
	return inquirer.prompt(qs);
}

function spin(promise, str) {
	if (!global.isInteractive) {
		return promise;
	}
	if (global.verboseLevel > 1) {
		log.debug(str);
		return promise;
	}

	const s = new Spinner(str);
	s.start();
	return when(promise).finally(() => s.stop(true));
}

function retry(fToRetry, times, handler, finalHandler) {
	if (!global.isInteractive) {
		times = 0;
	}

	return function retryFunc() {
		let tries = -1;
		const fContext = this;
		const args = Array.prototype.slice.call(arguments);

		function fAttempt(err) {
			tries++;
			if (tries >= times) {
				if (finalHandler) {
					return finalHandler(err);
				}
				return when.reject(err);
			}
			if (err) {
				handler(err);
			}
			return fToRetry.apply(fContext, args).catch(fAttempt);
		}
		return fAttempt();
	};
}

function render(templateName, data, supportingData) {
	if (global.outputJson) {
		process.stdout.write(JSON.stringify(data, null, 2));
		return;
	}
	process.stdout.write(Handlebars.templates[templateName](Object.assign({ data }, supportingData)));
}

module.exports = {
	prompt,
	spin,
	retry,
	render
};

