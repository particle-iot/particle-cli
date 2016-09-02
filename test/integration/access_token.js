

function access_token_from_settings() {
	const settings = require('../../settings');
	settings.whichProfile();
	settings.loadOverrides();
	return settings.access_token;
}

let token = undefined;
export function fetch_access_token() {
	if (token===undefined) {
		token = process.env.ACCESS_TOKEN || access_token_from_settings() || null;
	}
	return token;
}

export function it_has_access_token() {
	return fetch_access_token() ? it : xit;
}