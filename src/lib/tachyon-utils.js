const fs = require('fs-extra');
const os = require('os');
const { getEdlDevices } = require('particle-usb');
const { delay } = require('./utilities');
const DEVICE_READY_WAIT_TIME = 5000;
const UI = require('./ui');

const addLogHeaders = ({ outputLog, startTime, deviceId }) => {
	fs.appendFileSync(outputLog, `Tachyon Logs:${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `Using Device ID: ${deviceId}${os.EOL}`);
	fs.appendFileSync(outputLog, `Start time: ${startTime.toISOString()}${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
};

const addManifestInfoLog = ({ outputLog, manifest }) => {
	if (!manifest) {
		return;
	}
	fs.appendFileSync(outputLog, `Manifest Info:${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `Release name: ${manifest.release_name || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Version: ${manifest.version || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Region: ${manifest.region || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Variant: ${manifest.variant || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Platform: ${manifest.platform || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Board: ${manifest.board || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `OS: ${manifest.os || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Distribution: ${manifest.distribution || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Distribution version: ${manifest.distribution_version || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Distribution variant: ${manifest.distribution_variant || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Build date: ${manifest.build_date || ''}${os.EOL}`);
};

const addLogFooter = ({ outputLog, startTime, endTime }) => {
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `Process Done${os.EOL}`);
	fs.appendFileSync(outputLog, `End Time: ${endTime.toISOString()}${os.EOL}`);
	fs.appendFileSync(outputLog, `Duration: ${((endTime - startTime) / 1000).toFixed(2)}s${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `Tachyon Log Ended${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `${os.EOL}`);
};

const getEDLDevice = async ({ ui = new UI() } = {}) => {
	let edlDevices = [];
	let messageShown = false;
	while (edlDevices.length === 0) {
		try {
			edlDevices = await getEdlDevices();
			if (edlDevices.length > 0) {
				return edlDevices[0];
			}
			if (!messageShown) {
				if (ui) {
					ui.stdout.write(`Waiting for device to enter EDL mode...${os.EOL}`);
				} else {
					console.log(`Waiting for device to enter EDL mode...${os.EOL}`);
				}
				messageShown = true;
			}
		} catch (error) {
			// ignore error
		}
		await delay(DEVICE_READY_WAIT_TIME);
	}
};

module.exports = {
	addLogHeaders,
	addManifestInfoLog,
	addLogFooter,
	getEDLDevice
};
