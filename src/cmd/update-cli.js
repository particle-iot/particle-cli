const log = require('../lib/log');
const chalk = require('chalk');

/*
 * The update-cli command tells the CLI installer to reinstall the latest version of the CLI
 * See https://github.com/particle-iot/particle-cli-wrapper/blob/master/shell.go#L12
 *
 * If the CLI was installed using npm, tell the user to update using npm
 */
class UpdateCliCommand {
	update({ 'enable-updates': enableUpdates, 'disable-updates': disableUpdates }) {
		if (enableUpdates) {
			log.info('Automatic update checks are now enabled');
			return;
		}
		if (disableUpdates) {
			log.info('Automatic update checks are now disabled');
			return;
		}
		log.info(`Update the CLI by running ${chalk.bold('npm install -g particle-cli')}`);
	}
}

module.exports = UpdateCliCommand;
