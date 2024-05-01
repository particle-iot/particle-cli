const latestVersion = require('latest-version');
const settings = require('../../settings');
const execa = require('execa');
const { spawn } = require('child_process');


module.exports = async (skip, force) => {
	if (skip) {
		return;
	}
	if (!process.pkg) { // running from source
		return;
	}

	const now = Date.now();
	const lastCheck = settings.profile_json.last_version_check || 0;
	const skipUpdates = !!(settings.profile_json.enableUpdates === false || settings.disableUpdateCheck);

	if ((now - lastCheck >= settings.updateCheckInterval) || force){
		settings.profile_json.last_version_check = now;
		settings.saveProfileData();
		if (skipUpdates) {
			return;
		}
		console.log('exec', process.execPath);
		try {
			await spawn(process.execPath, ['update-cli'], {
				stdio: 'inherit'
			});
		} catch (error) {
			console.log(error);
		}

	}
};


module.exports.__internal__ = {
	latestVersion
};

