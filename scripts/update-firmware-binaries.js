var GitHubApi = require("github");
var http = require('http');
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

var gh = new GitHubApi();

var downloadedBinaries = [];
var settingsBinaries = [];

gh.repos.getReleaseByTag({ user: 'spark', repo: 'firmware', tag: versionTag })
.then(function (release) {
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

function cleanBinariesDirectory() {
	return rimraf(binariesDirectory + "/*");
};

function downloadFirmwareBinaries(assets) {
	Promise.all(assets.map(function (asset) {
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
		http.get(url, function (response) {
			response.pipe(file);
			fulfill();
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
