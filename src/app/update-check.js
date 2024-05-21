const settings = require('../../settings');
const childProcess = require('node:child_process');


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
		childProcess.spawn(process.execPath, [process.argv[1], 'update-cli'], {
			detached: true,
			stdio: 'ignore',
			windowsHide: true
		}).unref();
	}
};

