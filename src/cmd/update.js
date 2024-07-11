const ParticleApi = require('./api');
const { platformForId } = require('../lib/platform');
const settings = require('../../settings');
const semver = require('semver');

const usbUtils = require('./usb-util');
const deviceOsUtils = require('../lib/device-os-version-util');
const CLICommandBase = require('./base');
const { parseModulesToFlash, filterModulesToFlash, maintainDeviceProtection, createFlashSteps, flashFiles, validateDFUSupport } = require('../lib/flash-helper');
const createApiCache = require('../lib/api-cache');

module.exports = class UpdateCommand extends CLICommandBase {

	constructor(...args) {
		super(...args);
	}

	async updateDevice(deviceIdOrName, { target } = {}) {
		const { api, auth } = this._particleApi();
		if (target && !semver.valid(target)) {
			this.ui.write(`Invalid version: ${target}`);
			return;
		}
		// get device info
		const device = await usbUtils.getOneUsbDevice({ idOrName: deviceIdOrName, api, auth, ui: this.ui });

		const version = target || 'latest';
		validateDFUSupport({ device, ui: this.ui });

		// get platform info
		const platformName = platformForId(device.platformId).name;
		const versionText = version === 'latest' ? 'latest Device OS version' : `Device OS version ${version}`;
		this.ui.write(`Updating ${platformName} ${deviceIdOrName || device.id} to ${versionText}`);
		// get Device OS version
		const deviceOsBinaries = await deviceOsUtils.downloadDeviceOsVersionBinaries({
			api,
			platformId: device.platformId,
			version,
			ui: this.ui,
			omitUserPart: true
		});
		const deviceOsModules = await parseModulesToFlash({ files: deviceOsBinaries });
		const modulesToFlash = filterModulesToFlash({ modules: deviceOsModules, platformId: device.platformId, allowAll: true });
		await maintainDeviceProtection({ modules: modulesToFlash, device });
		const flashSteps = await createFlashSteps({ modules: modulesToFlash, isInDfuMode: device.isInDfuMode , platformId: device.platformId });
		await flashFiles({ device, flashSteps, ui: this.ui });
		this.ui.write('Update success!');
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth });
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}
};
