// This helper module is written mainly for the device protection module to not mess with the flash module directly
// and vice versa. This acts as a bridge between the two modules.
const settings = require('../../settings');
const ParticleApi = require('../cmd/api');
const createApiCache = require('../lib/api-cache');

async function getProtectionStatus(device) {
	const s = await device.getProtectionState();
	return s;
}

async function disableDeviceProtection(device) {
	const { api, auth } = _particleApi();
	const deviceId = device.id;
	let r = await api.unprotectDevice({ deviceId, action: 'prepare', auth });
	const serverNonce = Buffer.from(r.server_nonce, 'base64');

	const { deviceNonce, deviceSignature, devicePublicKeyFingerprint } = await device.unprotectDevice({ action: 'prepare', serverNonce });

	r = await api.unprotectDevice({
		deviceId,
		action: 'confirm',
		serverNonce: serverNonce.toString('base64'),
		deviceNonce: deviceNonce.toString('base64'),
		deviceSignature: deviceSignature.toString('base64'),
		devicePublicKeyFingerprint: devicePublicKeyFingerprint.toString('base64'),
		auth
	});

	const serverSignature = Buffer.from(r.server_signature, 'base64');
	const serverPublicKeyFingerprint = Buffer.from(r.server_public_key_fingerprint, 'base64');

	await device.unprotectDevice({ action: 'confirm', serverSignature, serverPublicKeyFingerprint });
}

async function turnOffServiceMode(device) {
	await device.unprotectDevice({ action: 'reset' });
}

function _particleApi() {
	const auth = settings.access_token;
	const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
	const apiCache = createApiCache(api);
	return { api: apiCache, auth };
}

module.exports = {
	getProtectionStatus,
	disableDeviceProtection,
	turnOffServiceMode
};
