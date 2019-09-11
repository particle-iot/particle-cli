const path = require('path');
const chalk = require('chalk');
const Spinner = require('cli-spinner').Spinner;
const settings = require('../../settings');
const { delay } = require('../lib/utilities');
const dfu = require('../lib/dfu');
const ModuleParser = require('binary-version-reader').HalModuleParser;
const ModuleInfo = require('binary-version-reader').ModuleInfo;
const FlashCommand = require('./flash');

Spinner.setDefaultSpinnerString(Spinner.spinners[7]);
const spin = new Spinner('Updating system firmware on the device...');

module.exports = class UpdateCommand {
	updateDevice() {
		return dfu.findCompatibleDFU().then((deviceId) => {
			return doUpdate(deviceId);
		}).catch((err) => {
			return dfuError(err);
		});
	}
};

function doUpdate(id) {
	const updates = settings.updates[id] || null;
	const steps = [];

	if (!updates) {
		console.log();
		return console.log(
			chalk.cyan('!'),
			'There are currently no system firmware updates available for this device.'
		);
	}
	const parts = Object.keys(updates);

	parts.forEach((part, partNumber) => {
		steps.push((next) => {
			const binary = path.resolve(__dirname, '../../assets/updates', updates[part]);
			const leave = partNumber === parts.length - 1;

			const parser = new ModuleParser();
			return parser.parseFile(binary)
				.catch(() => {
					return;
				})
				.then((mod) => {
					if (mod && mod.prefixInfo.moduleFunction !== ModuleInfo.FunctionType.BOOTLOADER) {
						// This is a valid non-bootloader module, use FlashCommand to handle all possible quirks
						// e.g. DROP_MODULE_INFO flag
						return new FlashCommand().flashDfu({ binary: binary, requestLeave: leave })
							.catch((err) => {
								throw new Error(err);
							});
					} else {
						// This is not a valid module and a simple binary, use DFU directly
						return dfu.write(binary, part, leave);
					}
				})
				.then((result) => delay(2000).then(() => result))
				.then((result) => next(null, result))
				.catch((error) => next(error));
		});
	});

	console.log();
	console.log(chalk.cyan('>'), 'Your device is ready for a system update.');
	console.log(chalk.cyan('>'), 'This process should take about 30 seconds. Here it goes!');
	console.log();

	if (global.verboseLevel > 0) {
		spin.start();
	}

	return new Promise((resolve, reject) => {
		flash();
		function flash(err) {
			if (err) {
				return failure(err);
			}
			if (steps.length > 0) {
				return steps.shift()(flash);
			}
			success();
		}

		function success() {
			spin.stop(true);
			console.log(chalk.cyan('!'), 'System firmware update successfully completed!');
			console.log();
			console.log(chalk.cyan('>'), 'Your device should now restart automatically.');
			console.log();
			resolve();
		}

		function failure(err) {
			spin.stop(true);
			console.log();
			console.log(chalk.red('!'), 'An error occurred while attempting to update the system firmware of your device:');
			console.log();
			console.log(chalk.bold.white(err.toString()));
			console.log();
			console.log(chalk.cyan('>'), 'Please visit our community forums for help with this error:');
			console.log(chalk.bold.white('https://community.particle.io/'));
			reject();
		}
	});
}

function dfuError(err) {
	if (err === 'No DFU device found') {
		// do nothing
	} else if (err.code === 127) {
		dfuInstall(true);
	} else {
		dfuInstall(false);
		console.log(
			chalk.cyan('!!!'),
			'You may also find our community forums helpful:\n',
			chalk.bold.white('https://community.particle.io/'),
			'\n'
		);
		console.log(
			chalk.red.bold('>'),
			'Error code:',
			chalk.bold.white(err.code || 'unknown'),
			'\n'
		);
	}
	process.exit(1);
}

function dfuInstall(noent) {

	if (noent) {
		console.log(chalk.red('!!!'), "It doesn't seem like DFU utilities are installed...");
	} else {
		console.log(chalk.red('!!!'), 'There was an error trying execute DFU utilities.');
	}
	console.log('');
	console.log(
		chalk.cyan('!!!'),
		'For help with installing DFU Utilities, please see:\n',
		chalk.bold.white('https://docs.particle.io/guide/tools-and-features/cli/#advanced-install')
	);
	console.log();
}

