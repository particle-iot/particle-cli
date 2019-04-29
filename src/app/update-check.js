const when = require('when');
const chalk = require('chalk');
const semver = require('semver');
const latestVersion = require('latest-version');
const pkg = require('../../package');
const settings = require('../../settings');


function spin() {
	return require('./ui').spin;
}

function check(skip, force) {
	return when.promise((resolve) => {
		if (skip) {
			return resolve();
		}

		const now = Date.now();
		const lastCheck = settings.profile_json.last_version_check || 0;
		if ((now - lastCheck >= settings.updateCheckInterval) || force) {
			settings.profile_json.last_version_check = now;
			checkVersion().then(() => {
				settings.saveProfileData();
				start();
				resolve();
			});
			return;
		}

		resolve();
	});
}

function checkVersion() {
	const checkPromise = when(latestVersion(pkg.name)).timeout(settings.updateCheckTimeout);

	return spin()(checkPromise, 'Checking for updates...')
		.then((version) => {
			if (semver.gt(version, pkg.version)) {
				settings.profile_json.newer_version = version;
			} else {
				delete settings.profile_json.newer_version;
			}
		})
		.catch(() => {});
}

function displayVersionBanner(version) {
	console.error('particle-cli v' + pkg.version);
	console.error();
	console.error(chalk.yellow('!'), 'A newer version (' + chalk.cyan(version) + ') of', chalk.bold.white('particle-cli'), 'is available.');
	console.error(chalk.yellow('!'), 'Upgrade now by running:', chalk.bold.white('npm install -g particle-cli'));
	console.error();
}

function start() {
	const storedVersion = settings.profile_json.newer_version;
	if (storedVersion && semver.gt(storedVersion, pkg.version)) {
		displayVersionBanner(storedVersion);
	}
}

module.exports = check;
