const chalk = require('chalk');

module.exports = class SetupCommand {
	setup() {
		console.log(`${chalk.bold.white('particle setup')} is no longer supported. Go to ${chalk.bold.cyan('setup.particle.io')} with your browser.\n`);
	}
};

