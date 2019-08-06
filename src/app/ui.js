const { Spinner } = require('cli-spinner');
const inquirer = require('inquirer');
const log = require('../lib/log');

Spinner.setDefaultSpinnerString(Spinner.spinners[7]);


module.exports.prompt = async (question) => {
	if (!global.isInteractive){
		throw new Error('Prompts are not allowed in non-interactive mode');
	}
	return inquirer.prompt(question);
};

module.exports.spin = async (promise, str) => {
	let spinner;

	if (!global.isInteractive){
		return promise;
	}

	if (global.verboseLevel > 1){
		log.debug(str);
		return promise;
	}

	try {
		spinner = new Spinner(str);
		spinner.start();
		return promise;
	} finally {
		spinner.stop(true);
	}
};

