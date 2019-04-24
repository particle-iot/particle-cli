

function accessTokenFromSettings() {
	const settings = require('../../settings');
	settings.whichProfile();
	settings.loadOverrides();
	return settings.access_token;
}

let token = undefined;
export function fetchAccessToken() {
	if (token===undefined) {
		token = process.env.ACCESS_TOKEN || accessTokenFromSettings() || null;
	}
	return token;
}

export function itHasAccessToken() {
	return fetchAccessToken() ? it : xit;
}
