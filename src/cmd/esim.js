const spinnerMixin = require('../lib/spinner-mixin');
const usbUtils = require('../cmd/usb-util');
const fs = require('fs-extra');
const utilities = require('../lib/utilities');
const os = require('os');
const { platformForId } = require('../lib/platform');
const CLICommandBase = require('./base');
const execa = require('execa');
const SerialCommand = require('./serial');
const FlashCommand = require('./flash');
const path = require('path');
const _ = require('lodash');

// TODO: Get these from exports
const PROVISIONING_PROGRESS = 1;
const PROVISIONING_SUCCESS = 2;
const PROVISIONING_FAILURE = 3;
const CTRL_REQUEST_APP_CUSTOM = 10;
const GET_AT_COMMAND_STATUS = 4;

const TEST_ICCID = ['89000123456789012341', '89000123456789012358'];

module.exports = class ESimCommands extends CLICommandBase {
	constructor() { // TODO: Bring ui class
		super();
		spinnerMixin(this);
		this.serial = new SerialCommand();
		this.lpa = null;
		this.inputJson = null;
		this.inputJsonData = null;
		this.outputFolder = null;
		this.downloadedProfiles = [];
		this.binaries = null;
		this.verbose = false;
		this.availableProvisioningData = new Set();
	}

	async provisionCommand(args) {
		this.verbose = true;
		this._validateArgs(args);

		await this._generateAvailableProvisioningData();

		// Get the serial port and device details
		const devices = await this.serial.findDevices();
		if (devices.length !== 1) {
			const errorMessage = devices.length > 1
				? 'Multiple devices found. Please unplug all but one device or use the --bulk option.'
				: 'No devices found.';
			throw new Error(errorMessage);
		}
		const device = devices[0];
		await this.doProvision(device);
	}

	async bulkProvisionCommand(args) {
		this._validateArgs(args);

		await this._generateAvailableProvisioningData();

		const provisionedDevices = new Set();
		setInterval(async () => {
			const devices = await this.serial.findDevices();
			for (const device of devices) {
				if (!provisionedDevices.has(device.deviceId)) {
					const deviceId = device.deviceId;
					provisionedDevices.add(deviceId);
					console.log(`Device ${deviceId} connected`);
					// Do not await here, so that the next device can be processed
					await this.doProvision(device);
				}
			}
		}, 1000);

		console.log('Ready to bulk provision. Connect devices to start. Press Ctrl-C to exit.');
	}

	// Populate the availableProvisioningData set with the indices of the input JSON data
	// If a profile is already provisioned (output JSON file exists with an entry), remove it from the set
	async _generateAvailableProvisioningData() {
		const files = fs.readdirSync(this.outputFolder);
		const jsonFiles = files.filter((file) => file.endsWith('.json'));
		for (let i = 0; i < this.inputJsonData.provisioning_data.length; i++) {
			this.availableProvisioningData.add(i);
		}
		for (const file of jsonFiles) {
			const json = fs.readFileSync(path.join(this.outputFolder, file));
			const data = JSON.parse(json);
			for (const entry of data) {
				// get the entry for which step: "expected_profiles"
				// once the entry is obtained, get the details.profiles array

				const expectedProfiles = entry.find((block) => block.step === 'expected_profiles');
				if (!expectedProfiles) {
					continue;
				}

				// Find the index of the provisioning_data block that matches the expectedProfiles
				const index = this.inputJsonData.provisioning_data.findIndex((block) => {
					return _.isEqual(block.profiles, expectedProfiles.details.profiles);
				});

				if (index !== -1) {
					this.availableProvisioningData.delete(index);
				}
			}
		}
	}

	async doProvision(device) {
		let provisionOutputLogs = [];
		let eid = null;
		let timestamp = new Date().toISOString().replace(/:/g, '-');
		let success = false;
		const outputJsonFile = path.join(this.outputFolder, `${device.deviceId}_${timestamp}.json`);

		const processOutput = async (failedLogs = []) => {
			const logs = Array.isArray(failedLogs) ? failedLogs : [failedLogs];
			provisionOutputLogs.push({
				step: 'final_step',
				timestamp: new Date().toISOString().replace(/:/g, '-'),
				success: success,
				details: {
					rawLogs: success ? ['Provisioning successful'] : ['Provisioning failed', ...logs],
				}
			});
			await this._changeLed(device, success ? PROVISIONING_SUCCESS : PROVISIONING_FAILURE);
			this._addToJson(outputJsonFile, provisionOutputLogs);
		};

		try {
			const platform = platformForId(device.specs.productId).name;
			const port = device.port;

			// Flash firmware and wait for AT to work
			const flashResp = await this._flashATPassThroughFirmware(device, platform);
			provisionOutputLogs.push(flashResp);
			if (flashResp.status === 'failed') {
				await processOutput();
				return;
			}

			// Get the EID
			const eidResp = await this._getEid(port);
			provisionOutputLogs.push(eidResp);
			if (eidResp.status === 'failed') {
				await processOutput();
				return;
			}
			eid = (eidResp.details.eid).trim();

			// If any profiles already exist on the device, skip provisioning
			// TODO: Check the TEST PROFILE situation with a brand new eSIM
			const profileCmdResp = await this._checkForExistingProfiles(port);
			provisionOutputLogs.push(profileCmdResp);
			if (profileCmdResp.status === 'failed') {
				await processOutput();
				return;
			}
			const existingProfiles = profileCmdResp.details.existingProfiles;
			if (existingProfiles.length > 0) {
				// remove profiles with test ICCID from existingProfiles to verify
				existingProfiles.forEach((profile, index) => {
					const iccid = profile.split('[')[1].split(',')[0].trim();
					if (TEST_ICCID.includes(iccid)) {
						existingProfiles.splice(index, 1);
					}
				});

				if (existingProfiles.length > 0) {
					success = false;
					provisionOutputLogs.push('Profiles already exist on the device');
					await processOutput();
					return;
				}
			}

			// Get the next available profile list from availableProvisioningData
			const profileResp = this._getProfiles();
			provisionOutputLogs.push(profileResp);
			if (profileResp.status === 'failed') {
				await processOutput();
				return;
			}

			const profilesToDownload = profileResp.details.profiles;
			const expectedIccids = profilesToDownload.map((profile) => profile.iccid);

			// Download each profile and update the JSON output
			await this._changeLed(device, PROVISIONING_PROGRESS);

			// provisionOutputLogs.push(`${os.EOL}Downloading profiles...`);
			const downloadResp = await this._doDownload(profilesToDownload, port);
			provisionOutputLogs.push(downloadResp);
			if (downloadResp.status === 'failed') {
				await processOutput();
				return;
			}

			const profilesMatch = await this._verifyAgainstListProfiles(port, expectedIccids);
			provisionOutputLogs.push(profilesMatch);
			if (profilesMatch.status === 'failed') {
				await processOutput();
				return;
			}

			success = true;
			console.log(`${os.EOL}Provisioning complete for EID ${eid}`);
			await processOutput();
			return;
		} catch (error) {
			await processOutput(error.message);
			return;
		}
	}

	_validateArgs(args) {
		if (!args) {
			throw new Error('Missing args');
		}

		const requiredArgs = {
			input: 'Missing input JSON file',
			lpa: 'Missing LPA tool path',
			binary: 'Missing folder path to binaries'
		};

		for (const [key, errorMessage] of Object.entries(requiredArgs)) {
			if (!args[key]) {
				throw new Error(errorMessage);
			}
		}

		this.inputJson = args.input;
		this.inputJsonData = JSON.parse(fs.readFileSync(this.inputJson));

		this.outputFolder = args.output || 'esim_loading_logs';
		if (!fs.existsSync(this.outputFolder)) {
			fs.mkdirSync(this.outputFolder);
		}

		this.lpa = args.lpa;
		this.binaries = args.binary;
	}


	async _verifyAgainstListProfiles(port, expectedIccids) {
		const res = {
			step: 'verify_profiles_after_download',
			timestamp: new Date().toISOString().replace(/:/g, '-'),
			status: 'failed',
			details: {
				expectedIccids: expectedIccids,
				iccidsOnDevice: [],
				rawLogs: []
			}
		};
		const profilesOnDeviceAfterDownload = await this._listProfiles(port);
		const iccidsOnDeviceAfterDownload = profilesOnDeviceAfterDownload.map((line) => line.split('[')[1].split(',')[0].trim());

		// remove test ICCIDs from iccidsOnDeviceAfterDownload
		const iccidsOnDeviceAfterDownloadFiltered = iccidsOnDeviceAfterDownload.filter((iccid) => !TEST_ICCID.includes(iccid));

		const equal = _.isEqual(_.sortBy(iccidsOnDeviceAfterDownload), _.sortBy(iccidsOnDeviceAfterDownloadFiltered));

		res.details.iccidsOnDevice = iccidsOnDeviceAfterDownload;
		res.details.rawLogs.push(equal ? ['Profiles on device match the expected profiles'] :
			['Profiles on device do not match the expected profiles']);
		res.status = equal ? 'success' : 'failed';

		return res;
	}

	async _flashATPassThroughFirmware(device, platform) {
		let status = 'failed';
		let timestamp = new Date().toISOString().replace(/:/g, '-');
		let logs = [];
		let fwPath = null;

		const logAndPush = (message) => {
			logs.push(message);
			if (this.verbose) {
				console.log(message);
			}
		};

		const stepOutput = () => ({
			step: 'flash_at_firmware',
			timestamp,
			details: {
				status: status,
				fwPath: fwPath,
				rawLogs: logs
			}
		});

		try {
			// Locate the firmware binary
			logAndPush(`${os.EOL}Locating firmware for platform: ${platform}`);

			const firmware = fs.readdirSync(this.binaries).find(file => file.endsWith(`${platform}.bin`));
			if (!firmware) {
				logAndPush(`No firmware binary found for platform: ${platform}`);
				return stepOutput();
			}

			fwPath = path.join(this.binaries, firmware);
			logAndPush(`${os.EOL}Found firmware: ${fwPath}`);

			// Flash the binary
			logAndPush(`${os.EOL}Flashing firmware...`);

			await this._runFlashCommand(device, fwPath);

			logAndPush(`${os.EOL}Firmware flashed successfully. Waiting for the device to reboot...`);

			// FIXME: The control request for the AT-OK check would give 'IN CONTROL transfer failed' without this delay
			await utilities.delay(5000);

			logAndPush(`${os.EOL}Checking for the AT-OK to work...`);

			const atOkReceived = await this._verifyAtOk(device);
			if (!atOkReceived) {
				logAndPush('AT-OK not received after flashing firmware');
				return stepOutput();
			}

			logAndPush('AT-OK received after flashing firmware');

			status = 'success';
			return stepOutput();
		} catch (error) {
			logs.push(`Failed to flash AT passthrough firmware: ${error.message}`);
			return stepOutput();
		}
	}

	async _verifyAtOk(device) {
		const usbDevice = await usbUtils.getOneUsbDevice({ idOrName: device.deviceId });
		let atOkReceived = false;
		const timeout = Date.now() + 30000;

		while (Date.now() < timeout && !atOkReceived) {
			try {
				const resp = await usbDevice.sendControlRequest(CTRL_REQUEST_APP_CUSTOM, JSON.stringify(GET_AT_COMMAND_STATUS));
				if (resp?.result === 0 && resp.data?.[0] === '1') {
					atOkReceived = true;
				}
			} catch (error) {
				// Ignore
			}

			if (!atOkReceived) {
				await utilities.delay(1000);
			}
		}
		await usbDevice.close();
		return atOkReceived;
	}

	async _runFlashCommand(device, fwPath) {
		const flashCmdInstance = new FlashCommand();
		await flashCmdInstance.flashLocal({
			files: [device.deviceId, fwPath],
			applicationOnly: true,
			verbose: false,
		});
	}


	async _getEid(port) {
		let status = 'failed';
		let timestamp = new Date().toISOString().replace(/:/g, '-');
		let logs = [];
		let eid = null;
		let command = `${this.lpa} getEid --serial=${port}`;

		const logAndPush = (message) => {
			logs.push(message);
			if (this.verbose) {
				console.log(message);
			}
		};

		const stepOutput = () => ({
			step: 'get_eid',
			timestamp: timestamp,
			details: {
				eid: eid,
				status: status,
				command: command,
				rawLogs: logs
			}
		});

		try {
			logAndPush(`${os.EOL}Getting EID from the device...`);
			const resEid = await execa(this.lpa, ['getEid', `--serial=${port}`]);
			const eidOutput = resEid.stdout;

			// Find the line starting with "EID: " and extract the EID
			eid = eidOutput
				.split('\n')
				.find((line) => line.startsWith('EID: '))
				?.split(' ')[1];

			if (!eid) {
				logAndPush('EID not found in the output');
				return stepOutput();
			}

			logAndPush(`EID: ${eid}`);
			status = 'success';
			return stepOutput();
		} catch (error) {
			logAndPush(`${os.EOL}Failed to retrieve EID: ${error.message}`);
			return stepOutput();
		}
	}

	// Check for profiles that are exsting on the device
	async _checkForExistingProfiles(port) {
		let logs = [];
		let existingProfiles = [];
		let status = 'failed';
		let timestamp = new Date().toISOString().replace(/:/g, '-');

		const logAndPush = (message) => {
			logs.push(message);
			if (this.verbose) {
				console.log(message);
			}
		};

		const stepOutput = () => ({
			step: 'check_existing_profiles',
			timestamp: timestamp,
			status: status,
			details: {
				existingProfiles: existingProfiles,
				rawLogs: logs
			}
		});

		try {
			logAndPush(`${os.EOL}Checking for existing profiles...`);
			const existingProfiles = await this._listProfiles(port);

			if (existingProfiles.length > 0) {
				logAndPush(`${os.EOL}Existing profiles found on the device:`);
				existingProfiles.forEach((profile) => logAndPush(`\t${profile}`));
			}
			logAndPush(`${os.EOL}No existing profiles found on the device`);
			status = 'success';
			return stepOutput();
		} catch (error) {
			logAndPush(`${os.EOL}Failed to check for existing profiles: ${error.message}`);
			return stepOutput();
		}
	}

	// Use lpa tool's listProfiles command to get the profiles on the device
	async _listProfiles(port) {
		const resProfiles = await execa(this.lpa, ['listProfiles', `--serial=${port}`]);
		const profilesOutput = resProfiles.stdout;
		const profilesList = profilesOutput
			.split('\n')
			.filter((line) => line.match(/^\d+:\[\w+,\s(?:enabled|disabled),\s?\]$/));
		return profilesList;
	}

	// Get the next available profile from availableProvisioningData
	// Once a profile is fetched, remove it from the set so other devices don't get the same profile
	_getProfiles() {
		const logs = [];
		let profiles = [];
		let status = 'failed';
		const timestamp = new Date().toISOString().replace(/:/g, '-');

		const stepOutput = () => ({
			step: 'expected_profiles',
			timestamp: timestamp,
			status,
			details: {
				profiles: profiles,
				rawLogs: logs
			}
		});

		if (!this.availableProvisioningData.size) {
			const message = 'No more profiles to provision';
			console.log(message);
			logs.push(message);
			return stepOutput();
		}

		const [index] = this.availableProvisioningData;
		profiles = this.inputJsonData.provisioning_data[index].profiles;
		this.availableProvisioningData.delete(index);
		status = 'success';

		return stepOutput();
	}


	// Download profiles to the device
	// Profiles are flashed one after another.
	// If any profile download fails, the process stops and the device is marked as failed
	async _doDownload(profiles, port) {
		const logs = [];
		const downloadedProfiles = [];
		let overallSuccess = false;

		const logAndPush = (messages) => {
			const logMessages = Array.isArray(messages) ? messages : [messages];
			logMessages.forEach((msg) => {
				logs.push(msg);
				if (this.verbose) {
					console.log(msg);
				}
			});
		};

		const stepOutput = () => ({
			step: 'download_profiles',
			timestamp: new Date().toISOString().replace(/:/g, '-'),
			status: overallSuccess ? 'success' : 'failed',
			details: {
				downloadedProfiles: downloadedProfiles,
				rawLogs: logs
			}
		});

		for (const [index, profile] of profiles.entries()) {
			/* eslint-disable-next-line camelcase */
			const { iccid, provider, smdp, matching_id } = profile;
			/* eslint-disable-next-line camelcase */
			const rspUrl = `1$${smdp}$${matching_id}`;
			const startTime = Date.now();

			logAndPush(`\n${index + 1}. Downloading ${provider} profile from ${rspUrl}`);
			let result, command;
			try {
				command = `${this.lpa} download ${rspUrl} --serial=${port}`;
				result = await execa(this.lpa, ['download', rspUrl, `--serial=${port}`]);
				const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

				if (result?.stdout.includes('Profile successfully downloaded')) {
					logAndPush(`\n\tProfile ${provider} successfully downloaded in ${timeTaken} sec`);
					logAndPush('\n\t LPA command result: ' + result?.stdout);
					overallSuccess = true;
					downloadedProfiles.push({
						status: 'success',
						iccid: iccid,
						provider: provider,
						duration: timeTaken,
						command: command
					});
				} else {
					logAndPush(`\n\tProfile download failed for ${provider}`);
					logAndPush('\n\t LPA command result: ' + result?.stdout);
					downloadedProfiles.push({
						status: 'failed',
						iccid: iccid,
						provider: provider,
						duration: timeTaken,
						command: command
					});
					break;
				}
			} catch (error) {
				const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
				logAndPush(`\n\tProfile download failed for ${provider} with error: ${error.message}`);
				logAndPush('\n\t LPA command result: ' + result?.stdout);
				downloadedProfiles.push({
					status: 'failed',
					iccid: iccid,
					provider: provider,
					duration: timeTaken,
					command: command
				});
				break;
			}
		}

		return stepOutput();
	}

	// Add the output logs to the output JSON file
	// If previous data exists, append to it
	_addToJson(jsonFile, data) {
		try {
			// Read and parse existing JSON data
			let existingJson = [];
			if (fs.existsSync(jsonFile)) {
				const existing = fs.readFileSync(jsonFile, 'utf-8');
				existingJson = JSON.parse(existing);
				if (!Array.isArray(existingJson)) {
					console.log('Existing JSON data is not an array');
					return;
				}
			}

			existingJson.push(data);

			// Write updated JSON back to the file with indentation
			fs.writeFileSync(jsonFile, JSON.stringify(existingJson, null, 4));
		} catch (error) {
			console.error(`Failed to append data to JSON file: ${error.message}`);
		}
	}

	// Sends a control request to change the LED state
	async _changeLed(device, state) {
		let outputLogs = [];
		let usbDevice;
		try {
			usbDevice = await usbUtils.getOneUsbDevice({ idOrName: device.deviceId });
			await usbDevice.sendControlRequest(CTRL_REQUEST_APP_CUSTOM, JSON.stringify(state));
			outputLogs.push('Led state changed to ' + state);
			return { success: true, output: outputLogs };
		} catch (err) {
			outputLogs.push(`Failed to change LED state: ${err.message}`);
			return { success: false, output: outputLogs };
		} finally {
			await usbDevice.close();
		}
	}
};