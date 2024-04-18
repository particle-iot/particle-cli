const latestVersion = require('latest-version');
const settings = require('../../settings');
const execa = require('execa');

module.exports = async (skip, force) => {
	if (skip) {
		return;
	}

	const now = Date.now();
	const lastCheck = settings.profile_json.last_version_check || 0;
	const skipUpdates = !settings.profile_json.enableUpdates || settings.disableUpdateCheck;

	if ((now - lastCheck >= settings.updateCheckInterval) || force){
		settings.profile_json.last_version_check = now;
		settings.saveProfileData();
		if (skipUpdates) {
			return;
		}
		execa('particle', ['update-cli']);
	}
};


module.exports.__internal__ = {
	latestVersion
};

