const chalk = require('chalk');

module.exports = class DoctorCommand {
	deviceDoctor(){
		console.log(`${chalk.bold.white('particle device doctor')} is no longer supported.`);
		console.log(`Go to the device doctor tool at ${chalk.bold.cyan('docs.particle.io/tools/doctor')}.\n`);
	}
};

