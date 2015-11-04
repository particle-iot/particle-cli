/**
 ******************************************************************************
 * @file    settings.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Setting module
 ******************************************************************************
  Copyright (c) 2014 Spark Labs, Inc.  All rights reserved.

  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU Lesser General Public
  License as published by the Free Software Foundation, either
  version 3 of the License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
  Lesser General Public License for more details.

  You should have received a copy of the GNU Lesser General Public
  License along with this program; if not, see <http://www.gnu.org/licenses/>.
  ******************************************************************************
 */


var fs = require('fs');
var path = require('path');
var extend = require('xtend');
var chalk = require('chalk');
var specs = require('./lib/deviceSpecs');

var settings = {
	commandPath: "./commands/",
	apiUrl: "https://api.particle.io",
	clientId: "CLI2",
	access_token: null,
	minimumApiDelay: 500,
	//useOpenSSL: true,
	useSudoForDfu: false,
	// TODO set to false once we give flags to control this
	verboseOutput: true,

	//2 megs -- this constant here is arbitrary
	MAX_FILE_SIZE: 1024 * 1024 * 2,

	overridesFile: null,
	wirelessSetupFilter: /^Photon-.*$/,

	notSourceExtensions: [
		".ds_store",
		".jpg",
		".gif",
		".png",
		".include",
		".ignore",
		".ds_store",
		".git",
		".bin"
	],
	showIncludedSourceFiles: true,

	dirIncludeFilename: "particle.include",
	dirExcludeFilename: "particle.ignore",

	knownApps: {
		"deep_update_2014_06": true,
		"cc3000": true,
		"cc3000_1_14": true,
		"tinker": true,
		"voodoo": true
	},
	updates: {
		"2b04:d006": {
			SystemFirmwareOne: "system-part1-0.4.7-photon.bin",
			SystemFirmwareTwo: "system-part2-0.4.7-photon.bin"
		},
		"2b04:d008": {
			SystemFirmwareOne: "system-part1-0.4.7-p1.bin",
			SystemFirmwareTwo: "system-part2-0.4.7-p1.bin"
		},
		"2b04:d00a": {
			SystemFirmwareOne: "system-part1-v0.0.3-rc.2-electron.bin",
			SystemFirmwareTwo: "system-part2-v0.0.3-rc.2-electron.bin"
		}
	},
	commandMappings: path.join(__dirname, "mappings.json")
};

//fix the paths on the known apps mappings
Object.keys(specs).forEach(function (id) {
	var deviceSpecs = specs[id];
	var knownApps = deviceSpecs["knownApps"];
	for(var appName in knownApps) {
		knownApps[appName] =  path.join(__dirname,"binaries", knownApps[appName]);
	};
});


settings.commandPath = __dirname + "/commands/";

settings.findHomePath = function() {
	var envVars = [
		'home',
		'HOME',
		'HOMEPATH',
		'USERPROFILE'
	];

	for(var i=0;i<envVars.length;i++) {
		var dir = process.env[envVars[i]];
		if (dir && fs.existsSync(dir)) {
			return dir;
		}
	}
	return __dirname;
};

settings.ensureFolder = function() {
	var particleDir = path.join(settings.findHomePath(), ".particle");
	if (!fs.existsSync(particleDir)) {
		fs.mkdirSync(particleDir);
	}
	return particleDir;
};

settings.findOverridesFile = function(profile) {
	profile = profile || settings.profile || "particle";

	var particleDir = settings.ensureFolder();
	return path.join(particleDir, profile + ".config.json");
};

settings.loadOverrides = function (profile) {
	profile = profile || settings.profile || "particle";

	try {
		var filename = settings.findOverridesFile(profile);
		if (fs.existsSync(filename)) {
			settings.overrides = JSON.parse(fs.readFileSync(filename));
			settings = extend(settings, settings.overrides);
		}
	}
	catch (ex) {
		console.error('There was an error reading ' + settings.overrides + ': ', ex);
	}
	return settings;
};

settings.whichProfile = function() {
	settings.profile = "particle";

	var particleDir = settings.ensureFolder();
	var proFile = path.join(particleDir, "profile.json");      //proFile, get it?
	if (fs.existsSync(proFile)) {
		var data = JSON.parse(fs.readFileSync(proFile));

		settings.profile = (data) ? data.name : "particle";
		settings.profile_json = data;
	}
};

/**
 * in another file in our user dir, we store a profile name that switches between setting override files
 */
settings.switchProfile = function(profileName) {
	var particleDir = settings.ensureFolder();
	var proFile = path.join(particleDir, "profile.json");      //proFile, get it?
	var data = {
		name: profileName
	};
	fs.writeFileSync(proFile, JSON.stringify(data, null, 2), { mode: '600' });
};

// this is here instead of utilities to prevent a require-loop
// when files that utilties requires need settings
function matchKey(needle, obj, caseInsensitive) {
	needle = (caseInsensitive) ? needle.toLowerCase() : needle;
	for (var key in obj) {
		var keyCopy = (caseInsensitive) ? key.toLowerCase() : key;

		if (keyCopy == needle) {
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
	}
	catch (ex) {
		console.error('There was an error writing ' + settings.overrides + ': ', ex);
	}
};

settings.transitionSparkProfiles = function() {
	var sparkDir = path.join(settings.findHomePath(), '.spark');
	var particleDir = path.join(settings.findHomePath(), '.particle');
	if (fs.existsSync(sparkDir) && !fs.existsSync(particleDir)) {
		fs.mkdirSync(particleDir);

		console.log();
		console.log(chalk.yellow('!!!'), "I detected a Spark profile directory, and will now migrate your settings.");
		console.log(chalk.yellow('!!!'), "This will only happen once, since you previously used our Spark-CLI tools.");
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
