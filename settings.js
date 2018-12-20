/**
 ******************************************************************************
 * @file    settings.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/particle-iot/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Setting module
 ******************************************************************************
  Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

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
'use strict';

var fs = require('fs');
var path = require('path');
var extend = require('xtend');
var _ = require('lodash');

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
	disableUpdateCheck: envValueBoolean('PARTICLE_DISABLE_UPDATE', false),
	updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
	updateCheckTimeout: 3000,

	//10 megs -- this constant here is arbitrary
	MAX_FILE_SIZE: 1024 * 1024 * 10,

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
			systemFirmwareOne: 'system-part1-0.7.0-photon-no-boot-dep.bin',
			systemFirmwareTwo: 'system-part2-0.7.0-photon-no-boot-dep.bin',
			userFirmware: 'ascender-0.7.0-photon.bin'
		},
		'2b04:d008': {
			systemFirmwareOne: 'system-part1-0.7.0-p1-no-boot-dep.bin',
			systemFirmwareTwo: 'system-part2-0.7.0-p1-no-boot-dep.bin',
			userFirmware: 'ascender-0.7.0-p1.bin'
		},
		'2b04:d00a': {
			// The bin files MUST be in this order to be flashed to the correct memory locations
			systemFirmwareOne:   'system-part2-0.7.0-electron.bin',
			systemFirmwareTwo:   'system-part3-0.7.0-electron.bin',
			systemFirmwareThree: 'system-part1-0.7.0-electron.bin'
		},
		'2b04:d00c': {
			systemFirmwareOne: 'system-part1-0.8.0-rc.27-argon.bin'
		},
		'2b04:d00d': {
			systemFirmwareOne: 'system-part1-0.8.0-rc.27-boron.bin'
		},
		'2b04:d00e': {
			systemFirmwareOne: 'system-part1-0.8.0-rc.27-xenon.bin'
		},
	},
};

function envValue(varName, defaultValue) {
	let value = process.env[varName];
	return (typeof value === 'undefined') ? defaultValue : value;
}

function envValueBoolean(varName, defaultValue) {
	let value = envValue(varName);
	if (value === 'true' || value === 'TRUE' || value === '1') {
		return true;
	} else if (value === 'false' || value === 'FALSE' || value === '0') {
		return false;
	} else {
		return defaultValue;
	}
}

settings.commandPath = __dirname + '/commands/';

settings.findHomePath = function() {
	let envVars = [
		'home',
		'HOME',
		'HOMEPATH',
		'USERPROFILE'
	];

	for (let i=0;i<envVars.length;i++) {
		let dir = process.env[envVars[i]];
		if (dir && fs.existsSync(dir)) {
			return dir;
		}
	}
	return __dirname;
};

settings.ensureFolder = function() {
	let particleDir = path.join(settings.findHomePath(), '.particle');
	if (!fs.existsSync(particleDir)) {
		fs.mkdirSync(particleDir);
	}
	return particleDir;
};

settings.findOverridesFile = function(profile) {
	profile = profile || settings.profile || 'particle';

	let particleDir = settings.ensureFolder();
	return path.join(particleDir, profile + '.config.json');
};

settings.loadOverrides = function (profile) {
	profile = profile || settings.profile || 'particle';

	try {
		let filename = settings.findOverridesFile(profile);
		if (fs.existsSync(filename)) {
			settings.overrides = JSON.parse(fs.readFileSync(filename));
			// need to do an in-situ extend since external clients may have already obtained the settings object
			// settings = extend(settings, settings.overrides);
			_.extend(settings, settings.overrides);
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
	let particleDir = settings.ensureFolder();
	let proFile = path.join(particleDir, 'profile.json');      //proFile, get it?
	if (fs.existsSync(proFile)) {
		try {
			let data = JSON.parse(fs.readFileSync(proFile));
			settings.profile = (data) ? data.name : 'particle';
			settings.profile_json = data;
		} catch (err) {
			throw new Error('Error parsing file '+proFile+': '+err);
		}
	} else {
		settings.profile = 'particle';
		settings.profile_json = {};
	}
};

settings.saveProfileData = function() {
	let particleDir = settings.ensureFolder();
	let proFile = path.join(particleDir, 'profile.json');      //proFile, get it?
	fs.writeFileSync(proFile, JSON.stringify(settings.profile_json, null, 2), { mode: '600' });
};

// this is here instead of utilities to prevent a require-loop
// when files that utilties requires need settings
function matchKey(needle, obj, caseInsensitive) {
	needle = (caseInsensitive) ? needle.toLowerCase() : needle;
	for (let key in obj) {
		let keyCopy = (caseInsensitive) ? key.toLowerCase() : key;

		if (keyCopy === needle) {
			//return the original
			return key;
		}
	}

	return null;
}

settings.override = function (profile, key, value) {
	if (!settings.overrides) {
		settings.overrides = {};
	}

	if (!settings[key]) {
		// find any key that matches our key, regardless of case
		let realKey = matchKey(key, settings, true);
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
		let filename = settings.findOverridesFile(profile);
		fs.writeFileSync(filename, JSON.stringify(settings.overrides, null, 2), { mode: '600' });
	} catch (ex) {
		console.error('There was an error writing ' + settings.overrides + ': ', ex);
	}
};

module.exports = settings;
