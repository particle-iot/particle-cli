const request = require('request');
const jose = require('jose');
const settings = require('../../settings');


const sleep = ms => new Promise(r => setTimeout(r, ms));
const _makeRequest = async ({ url, method, formData, body, urlEncoded }) => {
	return new Promise((resolve, reject) => {
		if (urlEncoded) {
			request.post({ url, form: { ...body } }, function cb(error, response, body) {
				if (error) {
					reject(error);
				}
				resolve(JSON.parse(body));
			});
		} else {
			request({ url: url, method: method, formData: formData }, function cb(error, response, body) {
				if (error) {
					reject(error);
				}
				resolve(JSON.parse(body));
			});
		}
	});
};

const getKeySet = (url) => {
	if (!this.jwks) {
		this.jwks = jose.createRemoteJWKSet(new URL(`${url}/keys`));
	}
	return this.jwks;
};

const _validateJwtToken = async (accessToken, url) => {
	return jose.jwtVerify(accessToken, getKeySet(url));
};

const _waitForLogin = async ({ deviceCode })  => {
	let canRequest = true;
	const ssoConfig = settings.ssoAuthConfig();
	const url = `${ssoConfig.ssoAuthUri}/token`;
	const clientId = ssoConfig.ssoClientId;
	const body = {
		device_code: deviceCode,
		grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
		client_id: clientId,
	};

	while (canRequest) {
		const response = await _makeRequest({ url, body, method: 'POST', urlEncoded: true });
		if (response.error === 'authorization_pending') {
			await sleep(5000);
		} else {
			canRequest = false;
			if (response.error) {
				throw new Error(response.error_description);
			}
			if (response.access_token) {
				const { payload } = await _validateJwtToken(response.access_token, ssoConfig.ssoAuthUri);
				return { token: payload.particle_profile, username: payload.sub };
			}
			throw new Error('Invalid data received');
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
	// TODO: login with sso
	const ssoConfig = settings.ssoAuthConfig();
	const formData = {
		client_id: ssoConfig.ssoClientId,
		scope: 'openid profile'
	};

	const response =  await _makeRequest({
		url: `${ssoConfig.ssoAuthUri}/device/authorize`,
		formData: formData,
		method: 'POST'
	});

	_printLoginMessage({ verificationUriComplete: response.verification_uri_complete });

	const data = await _waitForLogin({ deviceCode: response.device_code });
	console.log(data);
	return data;
};



module.exports = {
	ssoLogin
};
