'use strict';
const CLICommandBase = require('./base');
const path = require('path');
const os = require('os');

const {
	getEDLDevice,
	getTachyonInfo, handleFlashError,
	lookupCloudDeviceInfo
} = require('../lib/tachyon-utils');


module.exports = class IdentifyTachyonCommand extends CLICommandBase {
	constructor({ ui, api } = {}) {
		super();
		this.ui = ui || this.ui;
		this.api = api || this._particleApi().api;
	}

	/**
	 * A device in EDL mode reports its device ID over USB enumeration, before any
	 * firehose upload or partition read. Everything else worth knowing hangs off
	 * that ID in the cloud, so ask for it there first.
	 *
	 * The on-device read still runs, because it is the only source of the
	 * manufacturing-data check and the only source at all when the machine is
	 * offline or the CLI is not logged in. It is no longer allowed to sink the
	 * command: a partition layout this version of the CLI cannot parse used to make
	 * `identify` fail outright, even though the device ID had already been read.
	 */
	async identify() {
		const device = await getEDLDevice({ ui: this.ui });
		const outputLog = path.join(os.tmpdir(), `tachyon_${device.id}_identify_${Date.now()}.log`);

		const cloudInfo = await lookupCloudDeviceInfo({ deviceId: device.id, api: this.api });
		const localInfo = await this._readFromDevice({ device, outputLog });

		if (!cloudInfo && !localInfo) {
			this.ui.stdout.write(`Device ID: ${device.id}${os.EOL}`);
			this.ui.stdout.write(`Could not read this device, and it is not in your Particle account.${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information${os.EOL}`);
			return;
		}

		this.printIdentification(this._merge({ deviceId: device.id, cloudInfo, localInfo }));
	}

	/**
	 * Read what only the device itself can tell us. Returns null instead of throwing
	 * so a failed read degrades to whatever the cloud knows.
	 */
	async _readFromDevice({ device, outputLog }) {
		try {
			return await getTachyonInfo({ outputLog, ui: this.ui, device });
		} catch (error) {
			const { retry } = await handleFlashError({ error, ui: this.ui });
			if (retry) {
				return this._readFromDevice({ device, outputLog });
			}
			this.ui.stdout.write(`Could not read the device directly: ${error.message}${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information${os.EOL}${os.EOL}`);
			return null;
		}
	}

	/**
	 * The device wins on anything it could actually answer -- that comes from the
	 * hardware in front of you, whereas a cloud record is only as fresh as the
	 * device's last handshake. The cloud fills the gaps and adds what it alone knows.
	 */
	_merge({ deviceId, cloudInfo, localInfo }) {
		const local = localInfo || {};
		const cloud = cloudInfo || {};
		const localRegion = local.region && local.region !== 'Unknown' ? local.region : null;
		const region = localRegion || cloud.region || 'Unknown';

		return {
			deviceId,
			name: cloud.name,
			region,
			regionSource: !localRegion && cloud.region ? 'Particle Cloud' : null,
			serialNumber: cloud.serialNumber,
			modemFirmwareVersion: cloud.modemFirmwareVersion,
			manufacturingData: local.manufacturingData || null,
			osVersion: local.osVersion && local.osVersion !== 'Unknown' ? local.osVersion : null,
			imageVersion: cloud.imageVersion,
			imageVariant: cloud.imageVariant,
			productId: cloud.productId
		};
	}

	printIdentification(info) {
		const write = (label, value, suffix = '') => {
			if (value !== null && value !== undefined) {
				this.ui.stdout.write(`${label}: ${value}${suffix}${os.EOL}`);
			}
		};

		write('Device ID', info.deviceId);
		write('Name', info.name);
		write('Region', info.region, info.regionSource ? ` (from ${info.regionSource})` : '');
		write('Serial number', info.serialNumber);
		write('Modem firmware', info.modemFirmwareVersion);
		write('Manufacturing data', info.manufacturingData);
		write('OS Version', info.osVersion);
		if (info.imageVersion) {
			write('Image', `${info.imageVersion}${info.imageVariant ? ` (${info.imageVariant})` : ''}`);
		}
		write('Product', info.productId);
	}
};
