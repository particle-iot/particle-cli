const fs = require('fs');
const chalk = require('chalk');
const VError = require('verror');
const childProcess = require('child_process');
const { prompt } = require('../app/ui');

const UDEV_RULES_SYSTEM_PATH = '/etc/udev/rules.d';
const UDEV_RULES_FILE_NAME = '50-particle.rules';

const UDEV_RULES_SYSTEM_FILE = `${UDEV_RULES_SYSTEM_PATH}/${UDEV_RULES_FILE_NAME}`;
const UDEV_RULES_ASSET_FILE = `${__dirname}/../../assets/${UDEV_RULES_FILE_NAME}`;

let _systemSupportsUdev = undefined;
let _udevRulesInstalled = undefined;

/**
 * Check if the system uses udev.
 *
 * @return {Boolean}
 */
function systemSupportsUdev() {
	if (_systemSupportsUdev === undefined) {
		try {
			_systemSupportsUdev = fs.existsSync(UDEV_RULES_SYSTEM_PATH);
		} catch (e) {
			_systemSupportsUdev = false;
		}
	}
	return _systemSupportsUdev;
}

/**
 * Check if the system has the latest udev rules installed.
 *
 * @return {Boolean}
 */
function udevRulesInstalled() {
	if (_udevRulesInstalled !== undefined) {
		return _udevRulesInstalled;
	}
	if (!systemSupportsUdev()) {
		_udevRulesInstalled = false;
		return false;
	}
	// Try to load the installed rules file
	let current = null;
	try {
		current = fs.readFileSync(UDEV_RULES_SYSTEM_FILE);
	} catch (e) {
		_udevRulesInstalled = false;
		return false;
	}
	// Compare the installed file with the file bundled with this app
	const latest = fs.readFileSync(UDEV_RULES_ASSET_FILE);
	_udevRulesInstalled = current.equals(latest);
	return _udevRulesInstalled;
}

/**
 * Install the udev rules.
 *
 * @return {Promise}
 */
function installUdevRules() {
	if (!systemSupportsUdev()) {
		return Promise.reject(new Error('Not supported'));
	}
	return new Promise((resolve, reject) => {
		const cmd = `sudo cp "${UDEV_RULES_ASSET_FILE}" "${UDEV_RULES_SYSTEM_FILE}"`;
		console.log(cmd);
		childProcess.exec(cmd, err => {
			if (err) {
				_udevRulesInstalled = undefined;
				return reject(new VError(err, 'Could not install udev rules'));
			}
			_udevRulesInstalled = true;
			resolve();
		});
	});
}

/**
 * Prompts the user to install the udev rules.
 *
 * @param {Error} [err] Original error that led to this prompt.
 * @return {Promise}
 */
function promptAndInstallUdevRules(err = null) {
	if (!systemSupportsUdev()) {
		return Promise.reject(new Error('Not supported'));
	}
	if (udevRulesInstalled()) {
		if (err) {
			console.log(chalk.bold.red('Physically unplug and reconnect your Particle devices and try again.'));
			return Promise.reject(err);
		}
		return Promise.resolve();
	}
	console.log(chalk.yellow('You are missing the permissions to access USB devices without root.'));
	return prompt({
		type: 'confirm',
		name: 'install',
		message: 'Would you like to install a udev rules file to get access?',
		default: true
	})
		.then(r => {
			if (!r.install) {
				if (err) {
					throw err;
				}
				throw new Error('Cancelled');
			}
			return installUdevRules();
		})
		.then(() => {
			console.log('udev rules installed.');
			if (err) {
				console.log(chalk.bold.red('Physically unplug and reconnect your Particle devices and try again.'));
				throw err;
			}
		});
}

module.exports = {
	systemSupportsUdev,
	udevRulesInstalled,
	installUdevRules,
	promptAndInstallUdevRules
};

