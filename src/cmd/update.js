const ParticleApi = require('./api');
const { platformForId } = require('../lib/platform');
const settings = require('../../settings');

const usbUtils = require('./usb-util');
const deviceOsUtils = require('../lib/device-os-version-util');
const CLICommandBase = require('./base');
const { parseModulesToFlash, filterModulesToFlash, createFlashSteps, flashFiles } = require('../lib/flash-helper');

module.exports = class UpdateCommand extends CLICommandBase {

	constructor(...args) {
		super(...args);
	}

	async updateDevice(deviceIdOrName, { target }) {
		const { api, auth , particleApi } = this._particleApi();
		// get device info
		const device = await usbUtils.getOneUsbDevice({ deviceIdOrName, api, auth, ui: this.ui });
		const version = target || 'latest';
		// get platform info
		const platformName = platformForId(device.platformId).name;
		this.ui.write(`Updating ${platformName} ${deviceIdOrName || device.id} with version ${version}`);
		// get Device OS version
		const deviceOsBinaries = await deviceOsUtils.downloadDeviceOsVersionBinaries({
			api: particleApi,
			platformId: device.platformId,
			version,
			ui: this.ui,
			omitUserPart: true
		});
		const deviceOsModules = await parseModulesToFlash({ files: deviceOsBinaries });
		const modulesToFlash = filterModulesToFlash({ modules: deviceOsModules, platformId: device.platformId, allowAll: true });
		const flashSteps = await createFlashSteps({ modules: modulesToFlash, isInDfuMode: device.isInDfuMode , platformId: device.platformId });
		await flashFiles({ device, flashSteps, ui: this.ui });
		this.ui.write('Update success!');
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth });
		return { api: api.api, auth, particleApi: api };
	}
};
