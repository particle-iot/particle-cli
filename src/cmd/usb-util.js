import { prompt } from '../app/ui';
import { getDevice, isDeviceId } from './device-util';

import { getDevices, openDeviceById, NotFoundError, NotAllowedError } from 'particle-usb';

import chalk from 'chalk';
import when from 'when';
import VError from 'verror';
import * as fs from 'fs';
import * as childProcess from 'child_process';

const UDEV_RULES_SYSTEM_PATH = '/etc/udev/rules.d';
const UDEV_RULES_FILE_NAME = '50-particle.rules';

const UDEV_RULES_SYSTEM_FILE = `${UDEV_RULES_SYSTEM_PATH}/${UDEV_RULES_FILE_NAME}`;
const UDEV_RULES_ASSET_FILE = `${__dirname}/../../assets/${UDEV_RULES_FILE_NAME}`;

let _systemSupportsUdev = undefined;
let _udevRulesInstalled = undefined;

function handleDeviceOpenError(err) {
	if (err instanceof NotAllowedError) {
		err = new Error('Missing permissions to access the USB device');
		if (systemSupportsUdev()) {
			return promptAndInstallUdevRules(err);
		}
	}
	return when.reject(err);
}

/**
 * Check if the system uses udev.
 *
 * @return {Boolean}
 */
export function systemSupportsUdev() {
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
export function udevRulesInstalled() {
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
export function installUdevRules() {
	if (!systemSupportsUdev()) {
		return when.reject(new Error('Not supported'));
	}
	return when.promise((resolve, reject) => {
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
export function promptAndInstallUdevRules(err = null) {
	if (!systemSupportsUdev()) {
		return when.reject(new Error('Not supported'));
	}
	if (udevRulesInstalled()) {
		if (err) {
			console.log(chalk.bold.red('Physically unplug and reconnect your Particle devices and try again.'));
			return when.reject(err);
		}
		return when.resolve();
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

/**
 * Open a USB device.
 *
 * This function checks whether the user has necessary permissions to access the device.
 * Use this function instead of particle-usb's Device.open().
 *
 * @param {Object} usbDevice USB device.
 * @param {Object} options Options.
 * @param {Boolean} [options.dfuMode] Set to `true` if the device can be in DFU mode.
 * @return {Promise}
 */
export function openUsbDevice(usbDevice, { dfuMode = false } = {}) {
	if (!dfuMode && usbDevice.isInDfuMode) {
		return when.reject(new Error('The device should not be in DFU mode'));
	}
	return when.resolve().then(() => usbDevice.open())
		.catch(e => handleDeviceOpenError(e));
}

/**
 * Open a USB device with the specified device ID or name.
 *
 * This function checks whether the user has necessary permissions to access the device.
 * Use this function instead of particle-usb's openDeviceById().
 *
 * @param {Object} options Options.
 * @param {String} options.id Device ID or name.
 * @param {Object} options.api API client.
 * @param {String} options.auth Access token.
 * @param {Boolean} [options.dfuMode] Set to `true` if the device can be in DFU mode.
 * @param {String} [options.displayName] Device name as shown to the user.
 * @return {Promise}
 */
export function openUsbDeviceById({ id, api, auth, dfuMode = false, displayName = null }) {
	return when.resolve().then(() => {
		if (isDeviceId(id)) {
			// Try to open the device straight away
			return openDeviceById(id).catch(e => {
				if (!(e instanceof NotFoundError)) {
					return handleDeviceOpenError(e);
				}
			});
		}
	})
	.then(usbDevice => {
		if (!usbDevice) {
			return getDevice({ id, api, auth, displayName }).then(device => {
				if (device.id === id) {
					throw new NotFoundError();
				}
				return openDeviceById(device.id).catch(e => handleDeviceOpenError(e));
			})
			.catch(e => {
				if (e instanceof NotFoundError) {
					throw new Error(`Unable to connect to the device ${displayName || id}. Make sure the device is connected to the host computer via USB`);
				}
				throw e;
			});
		}
		return usbDevice;
	})
	.then(usbDevice => {
		if (!dfuMode && usbDevice.isInDfuMode) {
			return usbDevice.close().then(() => {
				throw new Error('The device should not be in DFU mode');
			});
		}
		return usbDevice;
	});
}

/**
 * Get the list of USB devices attached to the host.
 *
 * @param {Object} options Options.
 * @param {Boolean} [options.dfuMode] Set to `false` to exclude devices in DFU mode.
 * @return {Promise}
 */
export function getUsbDevices({ dfuMode = true } = {}) {
	return when.resolve().then(() => getDevices({ includeDfu: dfuMode }));
}
