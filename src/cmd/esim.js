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
const { verbose } = require('../lib/log');

// TODO: Get these from exports
const PATH_TO_PASS_THROUGH_BINARIES = '/Users/keerthyamisagadda/code/kigen-resources/binaries';


module.exports = class eSimCommands extends CLICommandBase {
	constructor() { // TODO: Bring ui class
		super();
		spinnerMixin(this);
        this.serial = new SerialCommand();
        this.lpa = null;
        this.inputJson = null;
        this.outputJson = null;
	}

	async provisionCommand(args) {
        this._validateArgs(args);

        // Get the serial port and device details
        const devices = await this.serial.findDevices();
        if (devices.length !== 1) {
            const errorMessage = deviceSerialPorts.length > 1
                ? 'Multiple devices found. Please unplug all but one device or use the --bulk option.'
                : 'No devices found.';
                throw new Error(errorMessage);
        }
        await this.doProvision(devices[0], { verbose: false });
	}

    async bulkProvisionCommand(args) {
        this._validateArgs(args);

        const provisionedDevices = new Set();
        setInterval(async () => {
            const devices = await this.serial.findDevices();
            for (const device of devices) {
                if (!provisionedDevices.has(device.deviceId)) {
                    provisionedDevices.add(device.deviceId);
                    doProvision(device, { verbose: false });
                }
            }
        }, 1000);

        console.log('Ready to bulk provision. Connect devices to start. Press Ctrl-C to exit.');
    }

    async doProvision(device, { verbose = false } = {}) {
        const platform = platformForId(device.specs.productId).name;
        const port = device.port;
        console.log(`${os.EOL}Provisioning device ${device.deviceId} with platform ${platform}`);
        // Flash firmware and retrieve EID
        await this._flashATPassThroughFirmware(device, platform, port);
        const eid = await this._getEid(port);
        console.log(`${os.EOL}EID: ${eid}`);

        // await this._checkForExistingProfiles(port);

		// Parse the JSON to get EID and profiles
        const input = fs.readFileSync(this.inputJson);
        const inputJsonData = JSON.parse(input);

        // Get the profile list that matches the EID that is given by the field eid
        const eidBlock = inputJsonData.EIDs.find((block) => block.esim_id === eid);

        if (!eidBlock || !eidBlock.profiles || eidBlock.profiles.length === 0) {
            throw new Error('No profiles to provision in the input JSON');
        }

        const profiles = eidBlock?.profiles;

        console.log(`${os.EOL}Provisioning the following profiles to EID ${eid}:`);
        profiles.forEach((profile, index) => {
            const rspUrl = `1\$${profile.smdp}\$${profile.matching_id}`;
            console.log(`\t${index + 1}. ${profile.provider} (${rspUrl})`);
        });

        // Download each profile
        for (const [index, profile] of profiles.entries()) {
            const rspUrl = `1\$${profile.smdp}\$${profile.matching_id}`;
            console.log(`${os.EOL}${index + 1}. Downloading ${profile.provider} profile from ${rspUrl}`);

            const start = Date.now();
            let timeTaken = 0;
            let iccid = null;

            try {
                const res = await execa(this.lpa, ['download', rspUrl, `--serial=${port}`]);
                timeTaken = ((Date.now() - start) / 1000).toFixed(2);

                const output = res.stdout;
                if (output.includes('Profile successfully downloaded')) {
                    console.log(`${os.EOL}\tProfile successfully downloaded in ${timeTaken} sec`);
                    const iccidLine = output.split('\n').find((line) => line.includes('Profile with ICCID'));
                    if (iccidLine) {
                        iccid = iccidLine.split(' ')[4]; // Extract ICCID
                    }
                } else {
                    console.log(`${os.EOL}\tProfile download failed`);
                }

                const outputData = {
                    EID: eid,
                    provider: profile.provider,
                    iccid,
                    time: timeTaken,
                    success: true,
                    output,
                };

                this._addToJson(this.outputJson, outputData);
            } catch (err) {
                const outputData = {
                    EID: eid,
                    provider: profile.provider,
                    iccid,
                    success: false,
                    time: timeTaken,
                    output: err.message,
                };
                this._addToJson(this.outputJson, outputData);
                throw new Error('Failed to download profile');
            }
        }
        console.log(`${os.EOL}Provisioning complete`);
    }

    _validateArgs(args) {
        if (!args) {
            throw new Error('Missing args');
        }
        if (!args.input) {
            throw new Error('Missing input json file');
        }
        if (!args.output) {
            throw new Error('Missing input output json file');
        }
        if (!args.lpa) {
            throw new Error('Missing input LPA tool path');
        }
        this.inputJson = args.input;
        this.outputJson = args.output;
        this.lpa = args.lpa;
    }

    async _getSerialPortForSingleDevice() {
        const deviceSerialPorts = await usbUtils.getUsbSystemPathsForMac();
        if (deviceSerialPorts.length !== 1) {
            const errorMessage = deviceSerialPorts.length > 1
                ? 'Multiple devices found. Please unplug all but one device or use the --bulk option.'
                : 'No devices found. Please connect a device and try again.';
                throw new Error(errorMessage);
            }
        return deviceSerialPorts[0];
    }

    async _getSerialPortsOfAllDevices() {
        const deviceSerialPorts = await usbUtils.getUsbSystemPathsForMac();
        if (deviceSerialPorts.length === 0) {
            throw new Error('No devices found. Please connect a device and try again.');
        }
        return deviceSerialPorts;
    }

    async _flashATPassThroughFirmware(device, platform, port) {
        // Locate the firmware binary
        console.log(`${os.EOL}Locating firmware for platform: ${platform}`);
        const fwBinaries = fs.readdirSync(PATH_TO_PASS_THROUGH_BINARIES);
        const validBin = fwBinaries.find((file) => file.endsWith(`${platform}.bin`));

        if (!validBin) {
            throw new Error(`No firmware binary found for platform: ${platform}`);
        }

        const fwPath = path.join(PATH_TO_PASS_THROUGH_BINARIES, validBin);
        console.log(`${os.EOL}Found firmware: ${fwPath}`);

        // Flash the firmware
        console.log(`${os.EOL}Flashing AT passthrough firmware to the device...`);
        const flashCmdInstance = new FlashCommand();
        await flashCmdInstance.flashLocal({
            files: [fwPath],
            applicationOnly: true,
            verbose: true,
        });
        console.log(`${os.EOL}Firmware flashed successfully`);

        // Wait for the device to respond
        console.log(`${os.EOL}Waiting for device to respond...`);
        const deviceResponded = await usbUtils.waitForDeviceToRespond(device.deviceId);

        if (!deviceResponded) {
            throw new Error('Device did not respond after flashing firmware');
        }
        console.log(`${os.EOL}Device responded successfully`);
        await deviceResponded.close();

        // Handle initial logs (temporary workaround)
        console.log(`${os.EOL}Clearing initial logs (temporary workaround)...`);
        console.log(`${os.EOL}--------------------------------------`);
        const monitor = await this.serial.monitorPort({ port, follow: false });

        // Wait for logs to clear
        await utilities.delay(30000); // 30-second delay
        await monitor.stop();
        await utilities.delay(5000); // Additional delay to ensure logs are cleared
        console.log(`${os.EOL}--------------------------------------`);
        console.log(`${os.EOL}Initial logs cleared`);
    }


    async _getEid(port) {
        console.log(`${os.EOL}Getting EID from the device...`);

        try {
            const resEid = await execa(this.lpa, ['getEid', `--serial=${port}`]);
            const eidOutput = resEid.stdout;

            // Find the line starting with "EID: " and extract the EID
            const eid = eidOutput
                .split('\n')
                .find((line) => line.startsWith('EID: '))
                ?.split(' ')[1];

            if (!eid) {
                throw new Error('EID not found in the output');
            }
            return eid;
        } catch (error) {
            console.error(`${os.EOL}Failed to retrieve EID: ${error.message}`);
            throw error;
        }
    }

    async _checkForExistingProfiles(port) {
        console.log(`${os.EOL}Checking for existing profiles...`);

        const resProfiles = await execa(this.lpa, ['listProfiles', `--serial=${port}`]);
        const profilesOutput = resProfiles.stdout;

        // Extract lines matching the profile format
        const profilesList = profilesOutput
            .split('\n')
            .filter((line) => line.match(/^\d+:\[\w+,\s(?:enabled|disabled),\s?\]$/));

        if (profilesList.length > 0) {
            console.error(`${os.EOL}Profile(s) already exist:`, profilesList);
            throw new Error('Profile(s) already exist. Troubleshoot manually.');
        }

        console.log(`${os.EOL}No existing profiles found`);
    }

    _addToJson(jsonFile, data) {
        try {
            // Read and parse existing JSON data
            let existingJson = [];
            if (fs.existsSync(jsonFile)) {
                const existing = fs.readFileSync(jsonFile, 'utf-8');
                existingJson = JSON.parse(existing);
                if (!Array.isArray(existingJson)) {
                    throw new Error('Existing JSON data is not an array');
                }
            }

            existingJson.push(data);

            // Write updated JSON back to the file with indentation
            fs.writeFileSync(jsonFile, JSON.stringify(existingJson, null, 4));
        } catch (error) {
            console.error(`Failed to append data to JSON file: ${error.message}`);
        }
    }

};
