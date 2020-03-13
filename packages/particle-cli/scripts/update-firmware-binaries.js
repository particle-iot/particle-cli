// If you want to update to a draft release, you need to add a token
// from https://github.com/settings/tokens with the repo scope to ../.env as
// GITHUB_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
require('dotenv').config();
var GitHub = require('github-api');
var request = require('request');
var fs = require('fs-extra');
var _ = require('lodash');

var githubUser = 'particle-iot';
var githubRepo = 'firmware';
var updatesDirectory = 'assets/updates';
var binariesDirectory = 'assets/binaries';
var settingsFile = 'settings.js';

if (process.argv.length !== 3) {
	exitWithMessage('Usage: npm run update-firmware-binaries <version>');
}

var versionTag = process.argv[2];
// GitHub version tags are like v0.5.0
if (versionTag[0] !== 'v') {
	versionTag = 'v' + versionTag;
}

var gh = new GitHub({ token: process.env.GITHUB_API_TOKEN });

var downloadedBinaries = [];
var settingsBinaries = [];

var repo = gh.getRepo(githubUser, githubRepo);
repo.listReleases()
	.then((result) => {
		var releases = result.data;
		var releaseId = releaseById(releases, versionTag);
		return repo.getRelease(releaseId);
	})
	.then((result) => {
		var release = result.data;
		return cleanUpdatesDirectory()
			.then(() => {
				return downloadFirmwareBinaries(release.assets);
			}).then(() => {
				return updateSettings();
			}).then(() => {
				return verifyBinariesMatch();
			}).then(() => {
				console.log('Done!');
			});
	}).catch((err) => {
		if (err.message) {
			exitWithMessage(err.message);
		}
		exitWithJSON(err);
	});

function releaseById(releases, tag) {
	var releaseId = null;
	releases.forEach((release) => {
		if (release.tag_name === tag) {
			releaseId = release.id;
		}
	});

	if (!releaseId) {
		throw new Error('Version ' + tag + ' not found');
	}
	return releaseId;
}

function cleanUpdatesDirectory() {
	return fs.emptyDir(updatesDirectory);
}

function downloadFirmwareBinaries(assets) {
	return Promise.all(assets.map((asset) => {
		if (asset.name.match(/^system-part/)) {
			return downloadFile(asset.browser_download_url, updatesDirectory);
		}
		if (asset.name.match(/^tinker.*core/)) {
			return downloadFile(asset.browser_download_url, binariesDirectory, 'core_tinker.bin');
		}
	}));
}

function downloadFile(url, directory, filename) {
	return new Promise((fulfill) => {
		filename = filename || url.match(/.*\/(.*)/)[1];
		console.log('Downloading ' + filename + '...');
		downloadedBinaries.push(filename);
		var file = fs.createWriteStream(directory + '/' + filename);
		file.on('finish', () => {
			file.close(() => {
				fulfill();
			});
		});
		request(url).pipe(file).on('error', (err) => {
			exitWithJSON(err);
		});
	});
}

function updateSettings() {
	var versionNumber = versionTag;
	if (versionNumber[0] === 'v') {
		versionNumber = versionNumber.substr(1);
	}

	var settings = fs.readFileSync(settingsFile, 'utf8');
	settings = settings.replace(/(system-part\d-).*(-.*.bin)/g, (filename, part, device) => {
		var newFilename = part + versionNumber + device;
		settingsBinaries.push(newFilename);
		return newFilename;
	});

	fs.writeFileSync(settingsFile, settings, 'utf8');
	console.log('Updated settings.js');

	// Add the core tinker binary to the expected list
	settingsBinaries.push('core_tinker.bin');
}

function verifyBinariesMatch() {
	downloadedBinaries = downloadedBinaries.sort();
	settingsBinaries = settingsBinaries.sort();
	if (!_.isEqual(downloadedBinaries, settingsBinaries)) {
		console.log("\n\nWARNING: the list of downloaded binaries doesn't match the list of binaries in settings.js");
		console.log('Downloaded:  ' + downloadedBinaries);
		console.log('settings.js: ' + settingsBinaries);
	}
}

function exitWithMessage(message) {
	console.log(message);
	process.exit(0);
}

function exitWithJSON(json) {
	exitWithMessage(JSON.stringify(json, true, 2));
}
