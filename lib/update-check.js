'use strict';

var when = require('when');
var latestVersion = require('latest-version');
var semver = require('semver');
var info = require('../package.json');
var settings = require('../settings');
var Spinner = require('cli-spinner').Spinner;
var chalk = require('chalk');
Spinner.setDefaultSpinnerString(Spinner.spinners[7]);

function check(next) {
	console.error('particle-cli v' + info.version);
	console.error();

	if (settings.disableUpdateCheck) {
		return next();
	}

	var now = Date.now();
	var lastCheck = settings.profile_json.last_version_check || 0;
	// check at most once an hour
	if (now - lastCheck >= settings.updateCheckInterval) {
		settings.profile_json.last_version_check = now;
		checkVersion(now, function () {
			settings.saveProfileData();
			start(next);
		});
		return;
	}

	start(next);
}

function checkVersion(now, next) {
	var spin = new Spinner('Checking for updates...');
	spin.start();
	when(latestVersion(info.name))
		.timeout(settings.updateCheckTimeout)
		.then(function (version) {
			spin.stop(true);
			if (semver.gt(version, info.version)) {
				settings.profile_json.newer_version = version;
			} else {
				delete settings.profile_json.newer_version;
			}
			next();
		})
		.catch(function () {
			spin.stop(true);
			next();
		});
}

function displayVersionBanner(version) {
	console.error(chalk.yellow('!'), 'A newer version (' + chalk.cyan(version) + ') of', chalk.bold.white('particle-cli'), 'is available.');
	console.error(chalk.yellow('!'), 'Upgrade now by running:', chalk.bold.white('npm install -g particle-cli'));
	console.error();
}

function start(next) {
	var storedVersion = settings.profile_json.newer_version;
	if (storedVersion && semver.gt(storedVersion, info.version)) {
		displayVersionBanner(storedVersion);
	}
	next();
}

module.exports = check;
