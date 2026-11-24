'use strict';
const fetch = require('node-fetch');
const querystring = require('querystring');
const jose = require('jose');
const openurl = require('./openurl');
const settings = require('../../settings');
const { getProxyAgent } = require('./http-proxy');
const WAIT_BETWEEN_REQUESTS = 5000;


const sleep = ms => new Promise(r => setTimeout(r, ms));
const _makeRequest = async ({ url, method, form }) => {
	const response = await fetch(url, {
		method,
		// querystring encodes the same way `request` did (spaces as %20)
		body: querystring.stringify(form),
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		agent: getProxyAgent(url, { proxyUrl: settings.proxyUrl })
	});
	// OAuth errors such as `authorization_pending` come with a 4xx status and a
	// JSON body the caller needs, so the body is parsed regardless of status
	return JSON.parse(await response.text());
};

const _getKeySet = (url) => {
	return jose.createRemoteJWKSet(new URL(`${url}/keys`));
};

const _validateJwtToken = async (accessToken, url) => {
	return jose.jwtVerify(accessToken, _getKeySet(url));
};

const waitForLogin = async ({ deviceCode, waitTime }) => {
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

const getLoginMessage = (verificationUriComplete) => {
	return [
		'Opening the SSO authorization page in your default browser.',
		'If the browser does not open or you wish to use a different device to authorize this request, open the following URL:',
		verificationUriComplete
	];
};

const ssoLogin = async () => {
	const ssoConfig = settings.ssoAuthConfig();
	const form = {
		client_id: ssoConfig.ssoClientId,
		scope: 'openid profile'
	};

	const response = await _makeRequest({
		url: `${ssoConfig.ssoAuthUri}/device/authorize`,
		form,
		method: 'POST'
	});

	openurl.open(response.verification_uri_complete, () => {
		// ignore errors opening the browser and let the user open the link manually
	});

	return { deviceCode: response.device_code, verificationUriComplete: response.verification_uri_complete };
};



module.exports = {
	ssoLogin,
	_makeRequest,
	waitForLogin,
	getLoginMessage

};
