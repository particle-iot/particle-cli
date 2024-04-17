const log = require('../lib/log');
const chalk = require('chalk');
const settings = require('../../settings');
/*
 * The update-cli command tells the CLI installer to reinstall the latest version of the CLI
 * See https://github.com/particle-iot/particle-cli-wrapper/blob/master/shell.go#L12
 *
 * If the CLI was installed using npm, tell the user to update using npm
 */
class UpdateCliCommand {
	update({ 'enable-updates': enableUpdates, 'disable-updates': disableUpdates, version }) {
		const dirPath = __dirname;
		if (enableUpdates) {
			return this.enableUpdates();
		}
		if (disableUpdates) {
			return this.disableUpdates();
		}
		if (!dirPath.includes('snapshot')) {
			log.info(`Update the CLI by running ${chalk.bold('npm install -g particle-cli')}`);
			log.info('To stay up to date with the latest features and improvements, please install the latest Particle Installer executable from our website: https://www.particle.io/cli');
			return;
		}
		return this.updateCli(version);
	}

	async enableUpdates() {
		// set the update flag to true
		settings.profile_json.enableUpdates = true;
		settings.saveProfileData();
		log.info('Automatic update checks are now enabled');
	}
	async disableUpdates() {
		// set the update flag to false
		settings.profile_json.enableUpdates = false;
		settings.saveProfileData();
		log.info('Automatic update checks are now disabled');
	}

	async updateCli(version) {
		log.info(`Updating the CLI to version ${version ? version : 'latest'}`);
	}
}

module.exports = UpdateCliCommand;
