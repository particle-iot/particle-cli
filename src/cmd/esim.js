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
const PATH_TO_PASS_THROUGH_BINARIES = '/Users/keerthyamisagadda/code/kigen-resources/binaries';
const PROVISIONING_PROGRESS = 1;
const PROVISIONING_SUCCESS = 2;
const PROVISIONING_FAILURE = 3;
const CTRL_REQUEST_APP_CUSTOM = 10;


module.exports = class eSimCommands extends CLICommandBase {
	constructor() { // TODO: Bring ui class
		super();
		spinnerMixin(this);
        this.serial = new SerialCommand();
        this.lpa = null;
        this.inputJson = null;
        this.inputJsonData = null;
        this.outputJson = null;
        this.downloadedProfiles = [];
        this.verbose = false;
	}

	async provisionCommand(args) {
        this.verbose = true;
        this._validateArgs(args);

        // Get the serial port and device details
        const devices = await this.serial.findDevices();
        if (devices.length !== 1) {
            const errorMessage = devices.length > 1
                ? 'Multiple devices found. Please unplug all but one device or use the --bulk option.'
                : 'No devices found.';
                throw new Error(errorMessage);
        }
        await this.doProvision(devices[0], { verbose: true });
	}

    async bulkProvisionCommand(args) {
        this._validateArgs(args);

        const provisionedDevices = new Set();
        setInterval(async () => {
            const devices = await this.serial.findDevices();
            for (const device of devices) {
                if (!provisionedDevices.has(device.deviceId)) {
                    provisionedDevices.add(device.deviceId);
                    await this.doProvision(device, { verbose: false });
                }
            }
        }, 1000);

        console.log('Ready to bulk provision. Connect devices to start. Press Ctrl-C to exit.');
    }

    async doProvision(device, { verbose = false } = {}) {
        let provisionOutputLogs = [];
        const timestamp = new Date().toISOString();
        const platform = platformForId(device.specs.productId).name;
        const port = device.port;
        if (verbose) {
            console.log(`${os.EOL}Provisioning device ${device.deviceId} with platform ${platform}`);
        }

        // Flash firmware and retrieve EID
        // const flashStatus = await this._flashATPassThroughFirmware(device, platform, port);
        // if (!flashStatus.success) {
        //     await this._changeLed(device, PROVISIONING_FAILURE);
        //     this._addToJson(this.outputJson, {
        //         EID: null,
        //         provider: null,
        //         iccid: null,
        //         success: false,
        //         timestamp: timestamp,
        //         time: 0,
        //         output: flashStatus.output,

        //     });
        //     return;
        // }
        // provisionOutputLogs.push(...flashStatus.output);

        const eidStatus = await this._getEid(port);
        if (!eidStatus.success) {
            await this._changeLed(device, PROVISIONING_FAILURE);
            this._addToJson(this.outputJson, {
                EID: null,
                provider: null,
                iccid: null,
                success: false,
                timestamp: timestamp,
                time: 0,
                output: eidStatus.output,
            });
            return;
        }
        provisionOutputLogs.push(...eidStatus.output);
        const eid = eidStatus.eid;

        const profileCmdStatus = await this._checkForExistingProfiles(port);
        if (!profileCmdStatus.success) {
            await this._changeLed(device, PROVISIONING_FAILURE);
            this._addToJson(this.outputJson, {
                EID: eid,
                provider: null,
                iccid: null,
                success: false,
                timestamp: timestamp,
                time: 0,
                output: profileCmdStatus.output,
            });
            return;
        }
        provisionOutputLogs.push(...profileCmdStatus.output);

        const profilesListOnDevice = profileCmdStatus.profilesList;
        const existingIccids = profilesListOnDevice.map((line) => line.split(' ')[4]);
        if (profilesListOnDevice.length > 0) {
            // extract the iccids that belong to this EID
            const matchingEsim = this.inputJsonData.provisioning_data.find(item => item.esim_id === eid);
            if (!matchingEsim) {
                provisionOutputLogs.push(`No profiles found for the given EID in the input JSON`);
                this._addToJson(this.outputJson, {
                    EID: eid,
                    provider: null,
                    iccid: null,
                    success: false,
                    timestamp: timestamp,
                    time: 0,
                    output: provisionOutputLogs,
                });
                return;
            }
            const iccidFromJson = matchingEsim.profiles.map((profile) => profile.iccid);
            const equal = _.isEqual(_.sortBy(existingIccids), _.sortBy(iccidFromJson));
            if (equal) {
                provisionOutputLogs.push(`Profiles already exist on the device for the given EID`);
                this._addToJson(this.outputJson, {
                    EID: eid,
                    provider: null,
                    iccid: null,
                    success: true,
                    timestamp: timestamp,
                    time: 0,
                    output: provisionOutputLogs,
                });
                return;
            }
        }

        // Get profiles for this EID from the input JSON
        const profileStatus = this._getProfiles(eid);
        if (!profileStatus.success) {
            await this._changeLed(device, PROVISIONING_FAILURE);
            this._addToJson(this.outputJson, {
                EID: eid,
                provider: null,
                iccid: null,
                success: false,
                timestamp: timestamp,
                time: 0,
                output: profileStatus.output,
            });
            return;
        }
        provisionOutputLogs.push(...profileStatus.output);

        console.log(`${os.EOL}Provisioning the following profiles to EID ${eid}:`);
        provisionOutputLogs.push(`${os.EOL}Provisioning the following profiles to EID ${eid}:`);

        const profiles = profileStatus.profiles;
        profiles.forEach((profile, index) => {
            const rspUrl = `1\$${profile.smdp}\$${profile.matching_id}`;
            console.log(`\t${index + 1}. ${profile.provider} (${rspUrl})`);
        });

        this._addToJson(this.outputJson, {
            EID: eid,
            provider: null,
            iccid: null,
            success: true,
            timestamp: timestamp,
            time: 0,
            output: provisionOutputLogs,
        });

        // ============================================================
        // TODO: Implement the download and update the JSON output as per the above in the next commit
        // ============================================================

        // await this._changeLed(device, PROVISIONING_PROGRESS);

        // // Download each profile and update the JSON output
        // const success = await this._doDownload(profiles, port, eid);

        //     // Update LED status based on provisioning result
        // const ledStatus = success ? PROVISIONING_SUCCESS : PROVISIONING_FAILURE;
        // await this._changeLed(device, ledStatus);

        // const profilesOnDevice = await this._listProfiles(port);
        // const iccids = profilesOnDevice.map((line) => line.split(' ')[4]);

        // console.log(`${os.EOL}Profiles downloaded:`);
        // for (const iccid of iccids) {
        //     const provider = this.downloadedProfiles.find((profile) => profile.iccid === iccid)?.provider;
        //     console.log(`\t${provider} - ${iccid}`);
        // }

        // console.log(`${os.EOL}Provisioning complete`);
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
        const input = fs.readFileSync(this.inputJson);
        this.inputJsonData = JSON.parse(input);

        this.outputJson = args.output;
        this.lpa = args.lpa;
    }

    async _flashATPassThroughFirmware(device, platform, port) {
        let outputLogs = [];
        const logAndPush = (message) => {
            outputLogs.push(message);
            if (this.verbose) {
                console.log(message);
            }
        };

        try {
            // Locate the firmware binary
            logAndPush(`${os.EOL}Locating firmware for platform: ${platform}`);
            const fwBinaries = fs.readdirSync(PATH_TO_PASS_THROUGH_BINARIES);
            const validBin = fwBinaries.find((file) => file.endsWith(`${platform}.bin`));

            if (!validBin) {
                logAndPush(`No firmware binary found for platform: ${platform}`);
                return { success: false, output: outputLogs };
            }

            const fwPath = path.join(PATH_TO_PASS_THROUGH_BINARIES, validBin);
            logAndPush(`${os.EOL}Found firmware: ${fwPath}`);

            // Flash the binary
            const flashCmdInstance = new FlashCommand();

            await flashCmdInstance.flashLocal({
                files: [device.deviceId, fwPath],
                applicationOnly: true,
                verbose: true,
            });
            logAndPush(`${os.EOL}Firmware flashed successfully`);

            // Wait for the device to respond
            logAndPush(`${os.EOL}Waiting for device to respond...`);
            const deviceResponded = await usbUtils.waitForDeviceToRespond(device.deviceId);

            if (!deviceResponded) {
                logAndPush('Device did not respond after flashing firmware');
                return { success: false, output: outputLogs };
            }
            logAndPush(`${os.EOL}Device responded successfully`);
            await deviceResponded.close();

            // Handle initial logs (temporary workaround)
            logAndPush(`${os.EOL}Clearing initial logs (temporary workaround)...`);
            logAndPush(`${os.EOL}--------------------------------------`);
            const monitor = await this.serial.monitorPort({ port, follow: false });

            // Wait for logs to clear
            await utilities.delay(30000); // 30-second delay
            await monitor.stop();
            await utilities.delay(5000); // Additional delay to ensure logs are cleared
            logAndPush(`${os.EOL}--------------------------------------`);
            logAndPush(`${os.EOL}Initial logs cleared`);

            return { success: true, output: outputLogs };
        } catch (error) {
            outputLogs.push(`Failed to flash AT passthrough firmware: ${error.message}`);
            return { success: false, output: outputLogs };
        }
    }


    async _getEid(port) {
        let outputLogs = [];
        const logAndPush = (message) => {
            outputLogs.push(message);
            if (this.verbose) {
                console.log(message);
            }
        };
        logAndPush(`${os.EOL}Getting EID from the device...`);
        try {
            const resEid = await execa(this.lpa, ['getEid', `--serial=${port}`]);
            const eidOutput = resEid.stdout;

            // Find the line starting with "EID: " and extract the EID
            const eid = eidOutput
                .split('\n')
                .find((line) => line.startsWith('EID: '))
                ?.split(' ')[1];

            if (!eid) {
                console.log('EID not found in the output');
                return { success: false, output: outputLogs };
            }
            return { success: true, eid, output: outputLogs };
        } catch (error) {
            logAndPush(`${os.EOL}Failed to retrieve EID: ${error.message}`);
            return { success: false, output: outputLogs };
        }
    }

    async _checkForExistingProfiles(port) {
        let outputLogs = [];
        const logAndPush = (message) => {
            outputLogs.push(message);
            if (this.verbose) {
                console.log(message);
            }
        };
        logAndPush(`${os.EOL}Checking for existing profiles...`);
        try {
            const profilesList = await this._listProfiles(port);

            if (profilesList.length > 0) {
                logAndPush(`${os.EOL}Existing profiles found on the device:`);
                profilesList.forEach((profile) => {
                    logAndPush(`\t${profile}`);
                });
                return { success: true, profilesList, output: outputLogs };
            }
        } catch (error) {
            logAndPush(`${os.EOL}Failed to check for existing profiles: ${error.message}`);
            return { success: false, output: outputLogs };
        }
    }

    async _listProfiles(port) {
        try {
            const resProfiles = await execa(this.lpa, ['listProfiles', `--serial=${port}`]);
            const profilesOutput = resProfiles.stdout;
            console.log('[dbg] profilesOutput: ', profilesOutput);

            // Extract lines matching the profile format
            const profilesList = profilesOutput
                .split('\n')
                .filter((line) => line.match(/^\d+:\[\w+,\s(?:enabled|disabled),\s?\]$/));

            return profilesList;
        } catch (error) {
            console.log(`${os.EOL}Failed to list profiles: ${error.message}`);
            return [];
        }
    }

    _getProfiles(eid) {
        // Get the profile list that matches the EID that is given by the field eid
        let outputLogs = [];
        const logAndPush = (message) => {
            outputLogs.push(message);
            if (this.verbose) {
                console.log(message);
            }
        };
        const eidBlock = this.inputJsonData.provisioning_data.find((block) => block.esim_id === eid);

        if (!eidBlock || !eidBlock.profiles || eidBlock.profiles.length === 0) {
            logAndPush('No profiles found for the given EID in the input JSON');
            return { success: false, output: outputLogs };
        }

        return { success: true, profiles: eidBlock?.profiles, output: outputLogs };
    }

    // TODO: Catch the error here and propagate the success/failure up
    async _doDownload(profiles, port, eid) {
        let success = true;
        let output = '';
        let iccid = null;
        let timeTaken = 0;
        for (const [index, profile] of profiles.entries()) {
            try {
                const rspUrl = `1\$${profile.smdp}\$${profile.matching_id}`;
                console.log(`${os.EOL}${index + 1}. Downloading ${profile.provider} profile from ${rspUrl}`);

                const start = Date.now();

                const res = await execa(this.lpa, ['download', rspUrl, `--serial=${port}`]);
                timeTaken = ((Date.now() - start) / 1000).toFixed(2);

                output = res.stdout;
                if (output.includes('Profile successfully downloaded')) {
                    success = true;
                    console.log(`${os.EOL}\tProfile successfully downloaded in ${timeTaken} sec`);
                    const iccidLine = output.split('\n').find((line) => line.includes('Profile with ICCID'));
                    if (iccidLine) {
                        iccid = iccidLine.split(' ')[4]; // Extract ICCID
                    }
                    this.downloadedProfiles.push({
                        provider: profile.provider,
                        iccid,
                    });
                } else {
                    success = false;
                    console.log(`${os.EOL}\tProfile download failed`);
                }
            } catch (error) {
                output = error.message;
                success = false;
                console.log(`${os.EOL}\tProfile download failed`);
            }

            const outputData = {
                EID: eid,
                provider: profile.provider,
                iccid: iccid,
                success: success,
                time: timeTaken,
                output,
            };
            this._addToJson(this.outputJson, outputData);
        }
        return success;
    }

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

    async _changeLed(device, state) {
        let usbDevice;
        try {
            usbDevice = await usbUtils.getOneUsbDevice({ idOrName: device.deviceId });
            await usbDevice.sendControlRequest(CTRL_REQUEST_APP_CUSTOM, JSON.stringify(state));
        } catch (err) {
            console.error(`Failed to change LED state: ${err.message}`);
        } finally {
            await usbDevice.close();
        }
    }
};
