const path = require('path');
const chalk = require('chalk');
const settings = require('../../settings.js');
const dfu = require('../lib/dfu');
const when = require('when');
const whenNode = require('when/node');
const Spinner = require('cli-spinner').Spinner;
const deviceSpecs = require('../lib/deviceSpecs');
const utilities = require('../lib/utilities.js');

Spinner.setDefaultSpinnerString(Spinner.spinners[7]);
const spin = new Spinner('Updating system firmware on the device...');

class UpdateCommand {
	updateDevice() {
		return dfu.findCompatibleDFU().then((deviceId) => {
			return doUpdate(deviceId);
		}).catch((err) => {
			return dfuError(err);
		});
	}
}

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
	const specs = deviceSpecs[id];
	/**
	 * Some firmwares also require updating the system bootloader.
	 */
	if (specs.requiresBootloaderAscenderApp) {
		const filename = 'user_firmware_backup.bin';

		steps.push((next) => {
			utilities.tryDelete(filename);

			// save the current user firmware
			whenNode.bindCallback(
				dfu.read(filename, 'userFirmware', false)
				, next);
		});

		steps.push((next) => {
			whenNode.bindCallback(
				dfu.write(filename, 'otaRegion', false)
				, next);
		});

		steps.push((next) => {
			whenNode.bindCallback(
				utilities.tryDelete(filename)
				, next);
		});
	}

	parts.forEach((part, partNumber) => {
		steps.push((next) => {
			const binary = path.resolve(__dirname, '../../assets/updates', updates[part]);
			const leave = partNumber === parts.length - 1;
			whenNode.bindCallback(
				dfu.write(binary, part, leave).delay(2000)
				, next);
		});
	});

	console.log();
	console.log(chalk.cyan('>'), 'Your device is ready for a system update.');
	console.log(chalk.cyan('>'), 'This process should take about ' + (specs.requiresBootloaderAscenderApp?50:30) + ' seconds. Here it goes!');
	console.log();

	if (global.verboseLevel > 0) {
		spin.start();
	}

	return when.promise((resolve, reject) => {
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

module.exports = UpdateCommand;
