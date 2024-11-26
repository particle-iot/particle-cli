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
const { log } = require('console');

// TODO: Get these from exports
const PROVISIONING_PROGRESS = 1;
const PROVISIONING_SUCCESS = 2;
const PROVISIONING_FAILURE = 3;
const CTRL_REQUEST_APP_CUSTOM = 10;
const GET_AT_COMMAND_STATUS = 4;

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
        this.binaries = null;
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
        const device = devices[0];
        const resp = await this.doProvision(device);
        await this._changeLed(device, resp.success ? PROVISIONING_SUCCESS : PROVISIONING_FAILURE);
        this._addToJson(this.outputJson, resp);
    }

    async bulkProvisionCommand(args) {
        this._validateArgs(args);

        const provisionedDevices = new Set();
        setInterval(async () => {
            const devices = await this.serial.findDevices();
            for (const device of devices) {
                if (!provisionedDevices.has(device.deviceId)) {
                    const deviceId = device.deviceId;
                    provisionedDevices.add(deviceId);
                    console.log(`Device ${deviceId} connected`);
                    const resp = await this.doProvision(device, { verbose: true });
                    await this._changeLed(device, resp.success ? PROVISIONING_SUCCESS : PROVISIONING_FAILURE);
                    this._addToJson(this.outputJson, resp);
                }
            }
        }, 1000);

        console.log('Ready to bulk provision. Connect devices to start. Press Ctrl-C to exit.');
    }

    async doProvision(device) {
        let provisionOutputLogs = [];
        let eid = null;
        let timestamp = null;
        let expectedProfilesArray = [];
        let downloadedProfilesArray = [];
        let success = false;

        // Add the output logs to the output JSON file in one msg
        const outputMsg = () => {
            return {
                esim_id: eid,
                device_id: device.deviceId,
                expectedProfiles: expectedProfilesArray,
                downloadedProfiles: downloadedProfilesArray,
                success: success,
                timestamp: timestamp,
                output: provisionOutputLogs
            }
        };

        try {
            timestamp = new Date().toISOString();
            const platform = platformForId(device.specs.productId).name;
            const port = device.port;

            provisionOutputLogs.push(`${os.EOL}Provisioning device ${device.deviceId} with platform ${platform}`);

            // Flash firmware and wait for AT to work
            const flashResp = await this._flashATPassThroughFirmware(device, platform);
            provisionOutputLogs.push(...flashResp.output);
            if (!flashResp.success) {
                return outputMsg();
            }
            provisionOutputLogs.push(`${os.EOL}Firmware flashed successfully`);

            // Get the EID
            const eidResp = await this._getEid(port);
            provisionOutputLogs.push(...eidResp.output);
            if (!eidResp.success) {
                return outputMsg();
            }
            eid = (eidResp.eid).trim();
            provisionOutputLogs.push(`EID: ${eid}`);

            // Get the profiles for this EID and compare them against the list in the input JSON under the same EID
            const matchingEsim = this.inputJsonData.provisioning_data.find(item => item.esim_id === eid);
            const iccidFromJson = matchingEsim.profiles.map((profile) => profile.iccid);
            expectedProfilesArray = matchingEsim.profiles;
            
            if (!matchingEsim || iccidFromJson?.length === 0 || expectedProfilesArray?.length === 0) {
                provisionOutputLogs.push('No profiles found for the given EID in the input JSON');
                return outputMsg();
            }

            const profileCmdResp = await this._checkForExistingProfiles(port);
            provisionOutputLogs.push(...profileCmdResp.output);
            if (!profileCmdResp.success) {
                return outputMsg();
            }

            const profilesListOnDevice = profileCmdResp.profilesList;
            const existingIccids = profilesListOnDevice.map((line) => line.split('[')[1].split(',')[0].trim());
            provisionOutputLogs.push(`${os.EOL}profilesListOnDevice: ${profilesListOnDevice}`);
            provisionOutputLogs.push(`${os.EOL}existingIccids: ${existingIccids}`);

            if (profilesListOnDevice.length > 0) {
                // extract the iccids that belong to this EID
                const matchingEsim = this.inputJsonData.provisioning_data.find(item => item.esim_id === eid);
                if (!matchingEsim) {
                    provisionOutputLogs.push('No profiles found for the given EID in the input JSON');
                    return outputMsg();
                }
                const iccidFromJson = matchingEsim.profiles.map((profile) => profile.iccid);
                const equal = _.isEqual(_.sortBy(existingIccids), _.sortBy(iccidFromJson));
                if (equal) {
                    success = true;
                    provisionOutputLogs.push('Profiles already provisioned correctly on the device for the given EID');
                    return outputMsg();
                } else {
                    provisionOutputLogs.push('Profiles exist on the device but do not match the profiles in the input JSON');
                    return outputMsg();
                }
            }

            // Get profiles for this EID from the input JSON
            const profileResp = this._getProfiles(eid);
            provisionOutputLogs.push(...profileResp.output);
            if (!profileResp.success) {
                return outputMsg();
            }

            provisionOutputLogs.push(`${os.EOL}Provisioning the following profiles to EID ${eid}:`);

            const profiles = profileResp.profiles;
            profiles.forEach((profile, index) => {
                const rspUrl = `1\$${profile.smdp}\$${profile.matching_id}`;
                provisionOutputLogs.push(`\t${index + 1}. ${profile.provider} (${rspUrl})`);
            });

            // Download each profile and update the JSON output
            await this._changeLed(device, PROVISIONING_PROGRESS);
            
            provisionOutputLogs.push(`${os.EOL}Downloading profiles...`);
            const downloadResp = await this._doDownload(profiles, port);
            const downloadedProfiles = downloadResp.downloadedProfiles;
            downloadedProfilesArray = downloadedProfiles.map((profile) => {
                return {
                    status: profile.status,
                    iccid: profile.iccid,
                    provider: profile.provider,
                    duration: profile.duration
                };
            });
            provisionOutputLogs.push(...downloadResp.output);

            if (!downloadResp.success) {
                provisionOutputLogs.push('Profile download failed');
                return outputMsg();
            }

            const profilesOnDeviceAfterDownload = await this._listProfiles(port);
            const iccidsOnDeviceAfterDownload = profilesOnDeviceAfterDownload.map((line) => line.split('[')[1].split(',')[0].trim());
            const equal = _.isEqual(_.sortBy(iccidsOnDeviceAfterDownload), _.sortBy(iccidFromJson));
            if (!equal) {
                provisionOutputLogs.push('Profiles did not match after download');
                return outputMsg();
            }

            // Update the JSON output with the downloaded profiles
            // Success case
            success = true;
            console.log(`${os.EOL}Provisioning complete for EID ${eid}`);
            provisionOutputLogs.push(`${os.EOL}Provisioning complete for EID ${eid}`);
            return outputMsg();
        } catch (error) {
            provisionOutputLogs.push(`Error during provisioning: ${error.message}`);
            return outputMsg();
        }
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
        if (!args.binary) {
            throw new Error('Missing folder path to binaries');
        }
        this.inputJson = args.input;
        const input = fs.readFileSync(this.inputJson);
        this.inputJsonData = JSON.parse(input);

        this.outputJson = args.output;
        this.lpa = args.lpa;
        this.binaries = args.binary;
    }

    async _flashATPassThroughFirmware(device, platform) {
        let outputLogs = [];
        const logAndPush = (message) => {
            const messages = Array.isArray(message) ? message : [message];
            messages.forEach(msg => {
                outputLogs.push(msg);
                if (this.verbose) {
                    console.log(msg);
                }
            });
        };

        try {
            // Locate the firmware binary
            logAndPush(`${os.EOL}Locating firmware for platform: ${platform}`);
            const fwBinaries = fs.readdirSync(this.binaries);
            const validBin = fwBinaries.find((file) => file.endsWith(`${platform}.bin`));

            if (!validBin) {
                logAndPush(`No firmware binary found for platform: ${platform}`);
                return { success: false, output: outputLogs };
            }

            const fwPath = path.join(this.binaries, validBin);
            logAndPush(`${os.EOL}Found firmware: ${fwPath}`);

            // Flash the binary
            const flashCmdInstance = new FlashCommand();

            logAndPush(`${os.EOL}Flashing firmware...`);
            await flashCmdInstance.flashLocal({
                files: [device.deviceId, fwPath],
                applicationOnly: true,
                verbose: true,
            });
            logAndPush(`${os.EOL}Firmware flashed successfully`);
            
            // FIXME: The control request for the AT-OK check would give 'IN CONTROL transfer failed' without this delay
            logAndPush('Waiting for the device to reboot...');
            await utilities.delay(5000);

            // Handle initial logs
            logAndPush(`${os.EOL}Checking for the AT-OK to work...`);
            let atOkReceived = false;
            const start = Date.now();
            const timeout = 30000;
            const usbDevice = await usbUtils.getOneUsbDevice({ idOrName: device.deviceId });
            while (Date.now() - start < timeout && !atOkReceived) {
                try {
                    const resp = await usbDevice.sendControlRequest(CTRL_REQUEST_APP_CUSTOM, JSON.stringify(GET_AT_COMMAND_STATUS));
                    // console.log('[dbg] resp: ', resp);
                    if (resp?.result === 0 && resp.data?.[0] === '1') {
                        logAndPush('AT-OK received');
                        atOkReceived = true;
                    }
                } catch (error) {
                    // Ignore
                    logAndPush(`Error during AT-OK check: ${error.message}`);
                }

                if (!atOkReceived) {
                    await utilities.delay(1000);
                }
            }
            await usbDevice.close();
            if (!atOkReceived) {
                logAndPush('AT-OK not received after flashing firmware');
                return { success: false, output: outputLogs };
            }
            return { success: true, output: outputLogs };
        } catch (error) {
            outputLogs.push(`Failed to flash AT passthrough firmware: ${error.message}`);
            return { success: false, output: outputLogs };
        }
    }


    async _getEid(port) {
        let outputLogs = [];
        const logAndPush = (message) => {
            const messages = Array.isArray(message) ? message : [message];
            messages.forEach(msg => {
                outputLogs.push(msg);
                if (this.verbose) {
                    console.log(msg);
                }
            });
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
                logAndPush('EID not found in the output');
                return { success: false, output: outputLogs };
            }
            return { success: true, eid, output: outputLogs };
        } catch (error) {
            logAndPush(`${os.EOL}Failed to retrieve EID: ${error.message}`);
            return { success: false, output: outputLogs };
        }
    }

    // Check for profiles that are exsting on the device
    async _checkForExistingProfiles(port) {
        let outputLogs = [];
        const logAndPush = (message) => {
            const messages = Array.isArray(message) ? message : [message];
            messages.forEach(msg => {
                outputLogs.push(msg);
                if (this.verbose) {
                    console.log(msg);
                }
            });
        };
        logAndPush(`${os.EOL}Checking for existing profiles...`);
        try {
            const profilesList = await this._listProfiles(port);

            if (profilesList.length > 0) {
                logAndPush(`${os.EOL}Existing profiles found on the device:`);
                profilesList.forEach((profile) => {
                    logAndPush(`\t${profile}`);
                });
            }
            return { success: true, profilesList, output: outputLogs };
        } catch (error) {
            logAndPush(`${os.EOL}Failed to check for existing profiles: ${error.message}`);
            return { success: false, output: outputLogs };
        }
    }

    // Use lpa tool's listProfiles command to get the profiles on the device
    async _listProfiles(port) {
        try {
            const resProfiles = await execa(this.lpa, ['listProfiles', `--serial=${port}`]);
            const profilesOutput = resProfiles.stdout;

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

    // Get the profiles that match the EID from the input JSON
    _getProfiles(eid) {
        // Get the profile list that matches the EID that is given by the field eid
        let outputLogs = [];
        const logAndPush = (message) => {
            const messages = Array.isArray(message) ? message : [message];
            messages.forEach(msg => {
                outputLogs.push(msg);
                if (this.verbose) {
                    console.log(msg);
                }
            });
        };
        logAndPush(`${os.EOL}Getting profiles for EID ${eid}...`);
        const eidBlock = this.inputJsonData.provisioning_data.find((block) => block.esim_id === eid);

        if (!eidBlock || !eidBlock.profiles || eidBlock.profiles.length === 0) {
            logAndPush('No profiles found for the given EID in the input JSON');
            return { success: false, output: outputLogs };
        }

        return { success: true, profiles: eidBlock?.profiles, output: outputLogs };
    }

    // Download profiles to the device
    // Profiles are flashed one after another.
    // If any profile download fails, the process stops and the device is marked as failed
    async _doDownload(profiles, port) {
        const outputLogs = [];
        const downloadedProfiles = [];
        let overallSuccess = true;

        const logAndPush = (messages) => {
            const logMessages = Array.isArray(messages) ? messages : [messages];
            logMessages.forEach((msg) => {
                outputLogs.push(msg);
                if (this.verbose) {
                    console.log(msg);
                }
            });
        };

        // console.log('[dbg] profiles: ', profiles);
        for (const [index, profile] of profiles.entries()) {
            const { iccid, provider, smdp, matching_id } = profile;
            const rspUrl = `1\$${smdp}\$${matching_id}`;
            const startTime = Date.now();

            logAndPush(`\n${index + 1}. Downloading ${provider} profile from ${rspUrl}`);

            try {
                const result = await execa(this.lpa, ['download', rspUrl, `--serial=${port}`]);
                console.log('[dbg] result: ', result);
                const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
                
                if (result.stdout.includes('Profile successfully downloaded')) {
                    // logAndPush(result.stdout);
                    logAndPush(`\n\tProfile ${provider} successfully downloaded in ${timeTaken} sec`);
                    downloadedProfiles.push({
                        status: "success",
                        iccid: iccid,
                        provider: provider,
                        duration: timeTaken,
                    });
                } else {
                    logAndPush(`\n\tProfile download failed for ${provider}`);
                    logAndPush(result.stdout);
                    overallSuccess = false;
                    downloadedProfiles.push({
                        status: "failed",
                        iccid: iccid,
                        provider: provider,
                        duration: timeTaken,
                    });
                    break;
                }
            } catch (error) {
                const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
                logAndPush(`\n\tProfile download failed for ${provider} with error: ${error.message}`);
                overallSuccess = false;
                downloadedProfiles.push({
                    status: "failed",
                    iccid: iccid,
                    provider: provider,
                    duration: timeTaken,
                });
                break;
            }
        }

        return {
            success: overallSuccess,
            downloadedProfiles,
            output: outputLogs
        };
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
