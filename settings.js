'use strict';

var fs = require('fs');
var path = require('path');
var extend = require('xtend');
var chalk = require('chalk');

var settings = {
	commandPath: './commands/',
	apiUrl: 'https://api.particle.io',
	buildUrl: 'https://build.particle.io',
	clientId: 'CLI2',
	access_token: null,
	minimumApiDelay: 500,
	//useOpenSSL: true,
	useSudoForDfu: false,
	// TODO set to false once we give flags to control this
	verboseOutput: true,
	disableUpdateCheck: false,
	updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
	updateCheckTimeout: 3000,

	//2 megs -- this constant here is arbitrary
	MAX_FILE_SIZE: 1024 * 1024 * 2,

	overridesFile: null,
	wirelessSetupFilter: /^Photon-.*$/,

	notSourceExtensions: [
		'.ds_store',
		'.jpg',
		'.gif',
		'.png',
		'.include',
		'.ignore',
		'.ds_store',
		'.git',
		'.bin'
	],
	showIncludedSourceFiles: true,

	dirIncludeFilename: 'particle.include',
	dirExcludeFilename: 'particle.ignore',

	knownApps: {
		'deep_update_2014_06': true,
		'cc3000': true,
		'cc3000_1_14': true,
		'tinker': true,
		'voodoo': true
	},
	knownPlatforms: {
		0: 'Core',
		6: 'Photon',
		8: 'P1',
		10: 'Electron',
		88: 'Duo',
		103: 'Bluz'
	},
	updates: {
		'2b04:d006': {
			systemFirmwareOne: 'system-part1-0.5.2-photon.bin',
			systemFirmwareTwo: 'system-part2-0.5.2-photon.bin'
		},
		'2b04:d008': {
			systemFirmwareOne: 'system-part1-0.5.2-p1.bin',
			systemFirmwareTwo: 'system-part2-0.5.2-p1.bin'
		},
		'2b04:d00a': {
			systemFirmwareOne: 'system-part1-0.5.2-electron.bin',
			systemFirmwareTwo: 'system-part2-0.5.2-electron.bin'
		}
	},
	commandMappings: path.join(__dirname, 'mappings.json')
};

settings.commandPath = __dirname + '/commands/';

settings.findHomePath = function() {
	var envVars = [
		'home',
		'HOME',
		'HOMEPATH',
		'USERPROFILE'
	];

	for (var i=0;i<envVars.length;i++) {
		var dir = process.env[envVars[i]];
		if (dir && fs.existsSync(dir)) {
			return dir;
		}
	}
	return __dirname;
};

settings.ensureFolder = function() {
	var particleDir = path.join(settings.findHomePath(), '.particle');
	if (!fs.existsSync(particleDir)) {
		fs.mkdirSync(particleDir);
	}
	return particleDir;
};

settings.findOverridesFile = function(profile) {
	profile = profile || settings.profile || 'particle';

	var particleDir = settings.ensureFolder();
	return path.join(particleDir, profile + '.config.json');
};

settings.loadOverrides = function (profile) {
	profile = profile || settings.profile || 'particle';

	try {
		var filename = settings.findOverridesFile(profile);
		if (fs.existsSync(filename)) {
			settings.overrides = JSON.parse(fs.readFileSync(filename));
			settings = extend(settings, settings.overrides);
		}
	} catch (ex) {
		console.error('There was an error reading ' + settings.overrides + ': ', ex);
	}
	return settings;
};

settings.whichProfile = function() {
	settings.profile = 'particle';
	settings.readProfileData();
};

/**
 * in another file in our user dir, we store a profile name that switches between setting override files
 */
settings.switchProfile = function(profileName) {
	if (!settings.profile_json) {
		settings.profile_json = {};
	}

	settings.profile_json.name = profileName;
	settings.saveProfileData();
};

settings.readProfileData = function() {
	var particleDir = settings.ensureFolder();
	var proFile = path.join(particleDir, 'profile.json');      //proFile, get it?
	if (fs.existsSync(proFile)) {
		var data = JSON.parse(fs.readFileSync(proFile));

		settings.profile = (data) ? data.name : 'particle';
		settings.profile_json = data;
	} else {
		settings.profile = 'particle';
		settings.profile_json = {};
	}
};

settings.saveProfileData = function() {
	var particleDir = settings.ensureFolder();
	var proFile = path.join(particleDir, 'profile.json');      //proFile, get it?
	fs.writeFileSync(proFile, JSON.stringify(settings.profile_json, null, 2), { mode: '600' });
};

// this is here instead of utilities to prevent a require-loop
// when files that utilties requires need settings
function matchKey(needle, obj, caseInsensitive) {
	needle = (caseInsensitive) ? needle.toLowerCase() : needle;
	for (var key in obj) {
		var keyCopy = (caseInsensitive) ? key.toLowerCase() : key;

		if (keyCopy === needle) {
			//return the original
			return key;
		}
	}

	return null;
};

settings.override = function (profile, key, value) {
	if (!settings.overrides) {
		settings.overrides = {};
	}

	if (!settings[key]) {
		// find any key that matches our key, regardless of case
		var realKey = matchKey(key, settings, true);
		if (realKey) {
			//console.log("Using the setting \"" + realKey + "\" instead ");
			key = realKey;
		}
	}

	//store the new value (redundant)
	settings[key] = value;

	//store that in overrides
	settings.overrides[key] = value;

	//make sure our overrides are in sync
	settings = extend(settings, settings.overrides);

	try {
		var filename = settings.findOverridesFile(profile);
		fs.writeFileSync(filename, JSON.stringify(settings.overrides, null, 2), { mode: '600' });
	} catch (ex) {
		console.error('There was an error writing ' + settings.overrides + ': ', ex);
	}
};

settings.transitionSparkProfiles = function() {
	var sparkDir = path.join(settings.findHomePath(), '.spark');
	var particleDir = path.join(settings.findHomePath(), '.particle');
	if (fs.existsSync(sparkDir) && !fs.existsSync(particleDir)) {
		fs.mkdirSync(particleDir);

		console.log();
		console.log(chalk.yellow('!!!'), 'I detected a Spark profile directory, and will now migrate your settings.');
		console.log(chalk.yellow('!!!'), 'This will only happen once, since you previously used our Spark-CLI tools.');
		console.log();

		var files = fs.readdirSync(sparkDir);
		files.forEach(function (filename) {
			var data = fs.readFileSync(path.join(sparkDir, filename));
			var jsonData;
			try {
				jsonData = JSON.parse(data);
			} catch (ex) {
				// invalid JSON, don't transition
				return;
			}

			if (filename === 'profile.json') {
				if (jsonData.name === 'spark') {
					jsonData.name = 'particle';
				}
			}

			if (filename === 'spark.config.json') {
				filename = 'particle.config.json';
			}

			if (jsonData.apiUrl && jsonData.apiUrl.indexOf('.spark.io') > 0) {
				jsonData.apiUrl = jsonData.apiUrl.replace('.spark.io', '.particle.io');
			}

			data = JSON.stringify(jsonData, null, 2);
			fs.writeFileSync(path.join(particleDir, filename), data, { mode: '600' });
		});
	}
};

settings.transitionSparkProfiles();
settings.whichProfile();
settings.loadOverrides();

module.exports = settings;
