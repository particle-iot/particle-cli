// If you want to update to a draft release, you need to add a token
// from https://github.com/settings/tokens with the repo scope to ../.env as
// GITHUB_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
require("dotenv").config();
var GitHub = require("github-api");
var request = require('request');
var fs = require('fs');
var rimraf = require('rimraf-promise');
var _ = require('lodash');

var githubUser = 'spark';
var githubRepo = 'firmware';
var binariesDirectory = 'updates';
var settingsFile = 'settings.js';

if (process.argv.length != 3) {
	exitWithMessage('Usage: npm run update-firmware-binaries <version>');
}

var versionTag = process.argv[2];
// GitHub version tags are like v0.5.0
if (versionTag[0] != 'v') {
	versionTag = 'v' + versionTag;
}

var gh = new GitHub({ token: process.env.GITHUB_API_TOKEN });

var downloadedBinaries = [];
var settingsBinaries = [];

var repo = gh.getRepo(githubUser, githubRepo);
repo.listReleases()
.then(function (result) {
	var releases = result.data;
	var releaseId = releaseById(releases, versionTag);
	return repo.getRelease(releaseId);
})
.then(function (result) {
	var release = result.data;
	return cleanBinariesDirectory()
	.then(function () {
		return downloadFirmwareBinaries(release.assets);
	}).then(function () {
		return updateSettings();
	}).then(function () {
		return verifyBinariesMatch();
	}).then(function () {
		console.log("Done!");
	});
}).catch(function (err) {
	if(err.message) exitWithMessage(err.message);
	exitWithJSON(err);
});

function releaseById(releases, tag) {
	var releaseId = null;
	releases.forEach(function (release) {
		if (release.tag_name === tag) {
			releaseId = release.id;
		}
	});

	if (!releaseId) {
		throw new Error('Version ' + tag + ' not found');
	}
	return releaseId;
}

function cleanBinariesDirectory() {
	return rimraf(binariesDirectory + "/*");
};

function downloadFirmwareBinaries(assets) {
	return Promise.all(assets.map(function (asset) {
		if (asset.name.match(/^system-part/)) {
			return downloadFile(asset.browser_download_url);
		}
	}));
}

function downloadFile(url) {
	return new Promise(function (fulfill) {
		var filename = url.match(/.*\/(.*)/)[1];
		console.log("Downloading " + filename + "...");
		downloadedBinaries.push(filename);
		var file = fs.createWriteStream(binariesDirectory + "/" + filename);
		file.on('finish', function () {
			file.close(function () {
				fulfill();
			});
		});
		request(url).pipe(file).on('error', function (err) {
			exitWithJSON(err);
		});
	});
}

function updateSettings() {
	var versionNumber = versionTag;
	if (versionNumber[0] == 'v') {
		versionNumber = versionNumber.substr(1);
	}

	var settings = fs.readFileSync(settingsFile, 'utf8');
	settings = settings.replace(/(system-part\d-).*(-.*.bin)/g, function (filename, part, device) {
		var newFilename = part + versionNumber + device;
		settingsBinaries.push(newFilename);
		return newFilename;
	});

	fs.writeFileSync(settingsFile, settings, 'utf8');
	console.log("Updated settings.js");
}

function verifyBinariesMatch() {
	downloadedBinaries = downloadedBinaries.sort();
	settingsBinaries = settingsBinaries.sort();
	if (!_.isEqual(downloadedBinaries, settingsBinaries)) {
		console.log("\n\nWARNING: the list of downloaded binaries doesn't match the list of binaries in settings.js");
		console.log("Downloaded:  " + downloadedBinaries);
		console.log("settings.js: " + settingsBinaries);
	}
}

function exitWithMessage(message) {
	console.log(message);
	process.exit(0);
}

function exitWithJSON(json) {
	exitWithMessage(JSON.stringify(json, true, 2));
}
