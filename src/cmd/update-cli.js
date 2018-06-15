const log = require('../lib/log');
const chalk = require('chalk');

/*
 * The update-cli command tells the CLI installer to reinstall the latest version of the CLI
 * See https://github.com/particle-iot/particle-cli-wrapper/blob/master/shell.go#L12
 *
 * If the CLI was installed using npm, tell the user to update using npm
 */
class UpdateCliCommand {
	update() {
		log.info(`Update the CLI by running ${chalk.bold('npm install -g particle-cli')}`);
	}
}

module.exports = UpdateCliCommand;
