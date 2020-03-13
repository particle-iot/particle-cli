const settings = require('../../settings');

// todo - this is a bad coupling since it calls back up to the enclosing app (via settings)
// the access token and other contextual items should be passed to the command as exteranl context (injection)

module.exports.buildAPIClient = (apiJS) => {
	return apiJS.client({ auth: settings.access_token });
};
