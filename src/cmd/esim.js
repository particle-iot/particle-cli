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

        const matchingEsim = this.inputJsonData.provisioning_data.find(item => item.esim_id === eid);
        const iccidFromJson = matchingEsim.profiles.map((profile) => profile.iccid);
        const expectedProfilesArray = matchingEsim.profiles;

        if (verbose) {
            console.log(`${os.EOL}Provisioning device ${device.deviceId} with platform ${platform}`);
        }

        // get IMEI
        const imeiResp = await this._getImei(device);
        let imei = null;
        if (imeiResp.success) {
            imei = imeiResp.imei;
            provisionOutputLogs.push(`IMEI: ${imei}`);
        }

        // Flash firmware and retrieve EID
        const flashResp = await this._flashATPassThroughFirmware(device, platform, port);
        if (!flashResp.success) {
            await this._changeLed(device, PROVISIONING_FAILURE);
            this._addToJson(this.outputJson, {
                EID: null,
                imei: imei,
                device_id: device.deviceId,
                provider: null,
                iccid: null,
                success: false,
                timestamp: timestamp,
                time: 0,
                output: flashResp.output,

            });
            return;
        }
        provisionOutputLogs.push(...flashResp.output);

        const eidResp = await this._getEid(port);
        if (!eidResp.success) {
            await this._changeLed(device, PROVISIONING_FAILURE);
            this._addToJson(this.outputJson, {
                EID: null,
                imei: imei,
                device_id: device.deviceId,
                provider: null,
                iccid: null,
                success: false,
                timestamp: timestamp,
                time: 0,
                output: eidResp.output,
            });
            return;
        }
        provisionOutputLogs.push(...eidResp.output);
        const eid = eidResp.eid;

        // const profileCmdResp = await this._checkForExistingProfiles(port);
        // if (!profileCmdResp.success) {
        //     await this._changeLed(device, PROVISIONING_FAILURE);
        //     this._addToJson(this.outputJson, {
        //         EID: eid,
        //         imei: imei,
        //         device_id: device.deviceId,
        //         provider: null,
        //         iccid: null,
        //         success: false,
        //         timestamp: timestamp,
        //         time: 0,
        //         output: profileCmdResp.output,
        //     });
        //     return;
        // }
        // provisionOutputLogs.push(...profileCmdResp.output);

        // const profilesListOnDevice = profileCmdResp.profilesList;
        // const existingIccids = profilesListOnDevice.map((line) => line.split(' ')[4]);
        // if (profilesListOnDevice.length > 0) {
        //     // extract the iccids that belong to this EID
        //     const matchingEsim = this.inputJsonData.provisioning_data.find(item => item.esim_id === eid);
        //     if (!matchingEsim) {
        //         provisionOutputLogs.push(`No profiles found for the given EID in the input JSON`);
        //         this._addToJson(this.outputJson, {
        //             esim_id: eid,
        //             imei: imei,
        //             device_id: device.deviceId,
        //             provider: null,
        //             iccid: null,
        //             success: false,
        //             timestamp: timestamp,
        //             time: 0,
        //             output: provisionOutputLogs,
        //         });
        //         return;
        //     }
        //     const iccidFromJson = matchingEsim.profiles.map((profile) => profile.iccid);
        //     const equal = _.isEqual(_.sortBy(existingIccids), _.sortBy(iccidFromJson));
        //     if (equal) {
        //         provisionOutputLogs.push('Profiles already exist on the device for the given EID');
        //         this._addToJson(this.outputJson, {
        //             esim_id: eid,
        //             imei: imei,
        //             device_id: device.deviceId,
        //             provider: null,
        //             iccid: null,
        //             success: true,
        //             timestamp: timestamp,
        //             time: 0,
        //             output: provisionOutputLogs,
        //         });
        //         return;
        //     } else {
        //         provisionOutputLogs.push('Profiles exist on the device but do not match the profiles in the input JSON');
        //         await this._changeLed(device, PROVISIONING_FAILURE);
        //         this._addToJson(this.outputJson, {
        //             esim_id: eid,
        //             imei: imei,
        //             device_id: device.deviceId,
        //             provider: null,
        //             iccid: null,
        //             success: false,
        //             timestamp: timestamp,
        //             time: 0,
        //             output: provisionOutputLogs,
        //         });
        //         return;
        //     }
        // }

        // Get profiles for this EID from the input JSON
        const profileResp = this._getProfiles(eid);
        if (!profileResp.success) {
            await this._changeLed(device, PROVISIONING_FAILURE);
            this._addToJson(this.outputJson, {
                esim_id: eid,
                imei: imei,
                device_id: device.deviceId,
                provider: null,
                iccid: null,
                success: false,
                timestamp: timestamp,
                time: 0,
                output: profileResp.output,
            });
            return;
        }
        provisionOutputLogs.push(...profileResp.output);

        console.log(`${os.EOL}Provisioning the following profiles to EID ${eid}:`);
        provisionOutputLogs.push(`${os.EOL}Provisioning the following profiles to EID ${eid}:`);

        const profiles = profileResp.profiles;
        profiles.forEach((profile, index) => {
            const rspUrl = `1\$${profile.smdp}\$${profile.matching_id}`;
            console.log(`\t${index + 1}. ${profile.provider} (${rspUrl})`);
        });

        this._addToJson(this.outputJson, {
            esim_id: eid,
            imei: imei,
            device_id: device.deviceId,
            provider: null,
            iccid: null,
            success: true,
            timestamp: timestamp,
            time: 0,
            output: provisionOutputLogs,
        });

        await this._changeLed(device, PROVISIONING_PROGRESS);

        // Download each profile and update the JSON output
        const downloadResp = await this._doDownload(profiles, port);
        provisionOutputLogs.push(...downloadResp.output);
        if (!downloadResp.success) {
            await this._changeLed(device, PROVISIONING_FAILURE);
            this._addToJson(this.outputJson, {
                esim_id: eid,
                imei: imei,
                device_id: device.deviceId,
                provider: null,
                iccid: null,
                success: false,
                timestamp: timestamp,
                time: 0,
                output: provisionOutputLogs,
            });
            return;
        }
        await this._changeLed(device, PROVISIONING_SUCCESS);

        const downloadedProfiles = downloadResp.downloadedProfiles; // timetaken, iccid, provider for each profile

        const profilesOnDeviceAfterDownload = await this._listProfiles(port);
        const iccidsOnDeviceAfterDownload = profilesOnDeviceAfterDownload.map((line) => line.split(' ')[4]);
        const equal = _.isEqual(_.sortBy(iccidsOnDeviceAfterDownload), _.sortBy(iccidFromJson));
        if (!equal) {
            provisionOutputLogs.push('Profiles did not match after download');
            await this._changeLed(device, PROVISIONING_FAILURE);
            this._addToJson(this.outputJson, {
                esim_id: eid,
                imei: imei,
                device_id: device.deviceId,
                provider: null,
                iccid: null,
                success: false,
                timestamp: timestamp,
                time: 0,
                output: provisionOutputLogs,
            });
            return;
        }

        // Update the JSON output with the downloaded profiles

        const downloadedProfilesArray = downloadedProfiles.map((profile) => {
            return {
                iccid: profile.iccid,
                provider: profile.provider,
                time: profile.timetaken,
            };
        });

        this._addToJson(this.outputJson, {
            esim_id: eid,
            imei: imei,
            device_id: device.deviceId,
            expectedProfiles: expectedProfilesArray,
            downloadedProfiles: downloadedProfilesArray,
            success: true,
            timestamp: timestamp,
            output: provisionOutputLogs
        });

        console.log(`${os.EOL}Provisioning complete for EID ${eid}`);
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
            const messages = Array.isArray(message) ? message : [message];
            messages.forEach(msg => {
                outputLogs.push(msg);
                if (this.verbose) {
                    console.log(msg);
                }
            });
        };
        const eidBlock = this.inputJsonData.provisioning_data.find((block) => block.esim_id === eid);

        if (!eidBlock || !eidBlock.profiles || eidBlock.profiles.length === 0) {
            logAndPush('No profiles found for the given EID in the input JSON');
            return { success: false, output: outputLogs };
        }

        return { success: true, profiles: eidBlock?.profiles, output: outputLogs };
    }

    // TODO: Catch the error here and propagate the success/failure up
    // Output of each downlaoded profile will have iccid, provider, time taken, output logs
    async _doDownload(profiles, port) {
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
        let success = true;
        let downloadedProfiles = [];
        for (const [index, profile] of profiles.entries()) {
            try {
                let iccid;
                const rspUrl = `1\$${profile.smdp}\$${profile.matching_id}`;
                logAndPush(`${os.EOL}${index + 1}. Downloading ${profile.provider} profile from ${rspUrl}`);

                const start = Date.now();

                const res = await execa(this.lpa, ['download', rspUrl, `--serial=${port}`]);
                const timeTaken = ((Date.now() - start) / 1000).toFixed(2);

                const output = res.stdout;
                // logAndPush(output);
                if (output.includes('Profile successfully downloaded')) {
                    success = true;
                    logAndPush(`${os.EOL}\tProfile ${profile.provider} and ${rspUrl} successfully downloaded in ${timeTaken} sec`);
                    const iccidLine = output.split('\n').find((line) => line.includes('Profile with ICCID'));
                    if (iccidLine) {
                        iccid = iccidLine.split(' ')[4]; // Extract ICCID
                    }
                    downloadedProfiles.push({ timetaken, iccid, provider: profile.provider });
                } else {
                    success = false;
                    logAndPush(`${os.EOL}\tProfile download failed`);
                    return { success, downloadedProfiles, output: outputLogs };
                }
            } catch (error) {
                success = false;
                logAndPush(`${os.EOL}\tProfile download failed with error: ${error.message}`);
                return { success, downloadedProfiles, output: outputLogs };
            }
        }
        return { success, downloadedProfiles, output: outputLogs };
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

    async _getImei(device) {
        let outputLogs = [];
        let usbDevice;
        try {
            usbDevice = await usbUtils.getOneUsbDevice({ idOrName: device.deviceId });
            const cellInfo = await usbDevice.getCellularInfo({ timeout: 20000 });
            outputLogs.push(`IMEI: ${cellInfo?.imei}`);
            return { success: true, imei: cellInfo?.imei, output: outputLogs };
        } catch (err) {
            outputLogs.push(`Failed to get IMEI: ${err.message}`);
            return { success: false, output: outputLogs };
        } finally {
            await usbDevice.close();
        }
    }
};
