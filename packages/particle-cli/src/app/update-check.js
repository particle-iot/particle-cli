const chalk = require('chalk');
const semver = require('semver');
const latestVersion = require('latest-version');
const settings = require('../../settings');
const pkg = require('../../package');
const ui = require('./ui');


module.exports = async (skip, force) => {
	const { displayVersionBanner } = module.exports.__internal__;

	if (skip) {
		return;
	}

	const now = Date.now();
	const lastCheck = settings.profile_json.last_version_check || 0;

	if ((now - lastCheck >= settings.updateCheckInterval) || force){
		settings.profile_json.last_version_check = now;

		try {
			const version = await getPublishedVersion(pkg, settings);

			if (semver.gt(version, pkg.version)){
				settings.profile_json.newer_version = version;
			} else {
				delete settings.profile_json.newer_version;
			}

			settings.saveProfileData();

			if (settings.profile_json.newer_version){
				displayVersionBanner(settings.profile_json.newer_version);
			}
		} catch (error){
			return;
		}
		return;
	}
};

async function getPublishedVersion(pkgJSON, settings){
	const { latestVersion } = module.exports.__internal__;

	try {
		const promise = withTimeout(latestVersion(pkgJSON.name), settings.updateCheckTimeout);
		return await ui.spin(promise, 'Checking for updates...');
	} catch (error){
		return pkgJSON.version;
	}
}

function displayVersionBanner(version){
	console.error('particle-cli v' + pkg.version);
	console.error();
	console.error(chalk.yellow('!'), 'A newer version (' + chalk.cyan(version) + ') of', chalk.bold.white('particle-cli'), 'is available.');
	console.error(chalk.yellow('!'), 'Upgrade now by running:', chalk.bold.white('particle update-cli'));
	console.error();
}

function withTimeout(promise, ms){
	const timer = delay(ms).then(() => {
		throw new Error('The operation timed out');
	});
	return Promise.race([promise, timer]);
}

function delay(ms){
	return new Promise((resolve) => setTimeout(resolve, ms));
}


module.exports.__internal__ = {
	latestVersion,
	displayVersionBanner
};

