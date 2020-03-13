function accessTokenFromSettings() {
	const settings = require('../../settings');
	settings.whichProfile();
	settings.loadOverrides();
	return settings.access_token;
}

let token = undefined;
function fetchAccessToken(){
	if (token===undefined) {
		token = process.env.ACCESS_TOKEN || accessTokenFromSettings() || null;
	}
	return token;
}

function itHasAccessToken(){
	return fetchAccessToken() ? it : xit;
}


module.exports.fetchAccessToken = fetchAccessToken;
module.exports.itHasAccessToken = itHasAccessToken;
