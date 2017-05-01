const settings = require('../../settings');

export function api() {

	const ParticleApi = require('../cmd/api').default;
	const settings = require('../../settings');

	if (!api._instance) {
		api._instance = new ParticleApi(settings.apiUrl, {
			accessToken: settings.access_token
		}).api;     // NB: .api so we are returning the configured particle-api-js client
	}
	return api._instance;
}

// todo - this is a bad coupling since it calls back up to the enclosing app (via settings)
// the access token and other contextual items should be passed to the command as exteranl context (injection)

export function buildAPIClient(apiJS = api()) {
	return apiJS.client({ auth: settings.access_token });
}
