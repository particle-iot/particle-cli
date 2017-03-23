import inquirer from 'inquirer';
import when from 'when';
import { Spinner } from 'cli-spinner';
import './templates';
import Handlebars from 'handlebars';
import log from './log';

Spinner.setDefaultSpinnerString(Spinner.spinners[7]);

function prompt(qs) {
	return when.promise(function promptPromise(resolve, reject) {
		if (!global.isInteractive) {
			return reject('prompts are not allowed in non-interactive mode');
		}

		inquirer.prompt(qs, function promptAnswers(answers) {
			resolve(answers);
		});
	});
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

export {
	prompt,
	spin,
	retry,
	render
};
