const request = require('request');
const jose = require('jose');
const openurl = require('openurl');
const settings = require('../../settings');
const WAIT_BETWEEN_REQUESTS = 5000;


const sleep = ms => new Promise(r => setTimeout(r, ms));
const _makeRequest = async ({ url, method, form }) => {
	return new Promise((resolve, reject) => {
		const requestData = { url, method, form };

		request(requestData, function cb(error, response, body) {
			if (error) {
				return reject(error);
			}
			return resolve(JSON.parse(body));
		});

	});
};

const _getKeySet = (url) => {
	return jose.createRemoteJWKSet(new URL(`${url}/keys`));
};

const _validateJwtToken = async (accessToken, url) => {
	return jose.jwtVerify(accessToken, _getKeySet(url));
};

const _waitForLogin = async ({ deviceCode, waitTime }) => {
	let canRequest = true;
	const ssoConfig = settings.ssoAuthConfig();
	const url = `${ssoConfig.ssoAuthUri}/token`;
	const clientId = ssoConfig.ssoClientId;
	const form = {
		device_code: deviceCode,
		grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
		client_id: clientId,
	};

	while (canRequest) {
		const response = await _makeRequest({ url, form, method: 'POST' });
		if (response.error === 'authorization_pending') {
			await sleep(waitTime || WAIT_BETWEEN_REQUESTS);
		} else {
			canRequest = false;
			if (response.error) {
				throw new Error(response.error_description);
			}
			if (response.access_token) {
				const { payload } = await _validateJwtToken(response.access_token, ssoConfig.ssoAuthUri);
				return { token: payload.particle_profile, username: payload.sub };
			}
			throw new Error('Unable to login through sso. Try again');
		}
	}
};

const _printLoginMessage = ({ verificationUriComplete }) => {
	console.log('\n' +
		'Opening the SSO authorization page in your default browser.\n' +
		'If the browser does not open or you wish to use a different device to authorize this request, open the following URL:\n' +
		'\n' +
		verificationUriComplete);
};

const ssoLogin = async () => {
	const ssoConfig = settings.ssoAuthConfig();
	const form = {
		client_id: ssoConfig.ssoClientId,
		scope: 'openid profile'
	};

	const response =  await _makeRequest({
		url: `${ssoConfig.ssoAuthUri}/device/authorize`,
		form,
		method: 'POST'
	});

	_printLoginMessage({ verificationUriComplete: response.verification_uri_complete });
	openurl.open(response.verification_uri_complete);

	return await _waitForLogin({ deviceCode: response.device_code });
};



module.exports = {
	ssoLogin,
	_makeRequest,
	_waitForLogin

};
