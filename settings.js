const fs = require('fs');
const path = require('path');
const extend = require('xtend');
const _ = require('lodash');
const { PlatformId } = require('./src/lib/platform');


let settings = {
	apiUrl: 'https://api.particle.io',
	clientId: 'CLI2',
	access_token: null,
	minimumApiDelay: 500,
	useSudoForDfu: false,
	flashWarningShownOn: null,
	// TODO set to false once we give flags to control this
	disableUpdateCheck: envValueBoolean('PARTICLE_DISABLE_UPDATE', false),
	updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
	updateCheckTimeout: 3000,

	//10 megs -- this constant here is arbitrary
	MAX_FILE_SIZE: 1024 * 1024 * 10,

	wirelessSetupFilter: /^Photon-.*$/,

	serial_follow_delay: 250,

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

	cloudKnownApps: {
		'tinker': true
	},
	updates: {
		// TODO: The firmware binaries are flashed in the order in which they're listed here. Ideally,
		// the order should be determined based on the module dependency tree. For now, make sure the
		// bootloader is flashed first, then radio stack, system part modules and finally NCP firmware
		[PlatformId.PHOTON]: [
			'photon-bootloader@2.3.1+lto.bin',
			'photon-system-part1@2.3.1.bin',
			'photon-system-part2@2.3.1.bin'
		],
		[PlatformId.P1]: [
			'p1-bootloader@2.3.1+lto.bin',
			'p1-system-part1@2.3.1.bin',
			'p1-system-part2@2.3.1.bin'
		],
		[PlatformId.ELECTRON]: [
			'electron-bootloader@2.3.1+lto.bin',
			'electron-system-part1@2.3.1.bin',
			'electron-system-part2@2.3.1.bin',
			'electron-system-part3@2.3.1.bin'
		],
		[PlatformId.ARGON]: [
			'argon-bootloader@4.0.2.bin',
			'argon-softdevice@4.0.2.bin',
			'argon-system-part1@4.0.2.bin'
		],
		[PlatformId.BORON]: [
			'boron-bootloader@4.0.2.bin',
			'boron-softdevice@4.0.2.bin',
			'boron-system-part1@4.0.2.bin'
		],
		[PlatformId.XENON]: [
			'xenon-bootloader@1.5.2.bin',
			'xenon-softdevice@1.5.2.bin',
			'xenon-system-part1@1.5.2.bin'
		],
		[PlatformId.BSOM]: [
			'bsom-bootloader@4.0.2.bin',
			'bsom-softdevice@4.0..bin',
			'bsom-system-part1@4.0.2.bin'
		],
		[PlatformId.B5SOM]: [
			'b5som-bootloader@4.0.2.bin',
			'b5som-softdevice@4.0.2.bin',
			'b5som-system-part1@4.0.2.bin'
		],
		[PlatformId.TRACKER]: [
			'tracker-bootloader@4.0.2.bin',
			'tracker-softdevice@4.0.2.bin',
			'tracker-system-part1@4.0.2.bin'
		],
		[PlatformId.ESOMX]: [
			'esomx-bootloader@4.0.2.bin',
			'esomx-softdevice@4.0..bin',
			'esomx-system-part1@4.0.2.bin'
		],
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

settings.findHomePath = () => {
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

settings.ensureFolder = () => {
	let particleDir = path.join(settings.findHomePath(), '.particle');
	if (!fs.existsSync(particleDir)) {
		fs.mkdirSync(particleDir);
	}
	return particleDir;
};

settings.findOverridesFile = (profile) => {
	profile = profile || settings.profile || 'particle';

	let particleDir = settings.ensureFolder();
	return path.join(particleDir, profile + '.config.json');
};

settings.loadOverrides = (profile) => {
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

settings.whichProfile = () => {
	settings.profile = 'particle';
	settings.readProfileData();
};

/**
 * in another file in our user dir, we store a profile name that switches between setting override files
 */
settings.switchProfile = (profileName) => {
	if (!settings.profile_json) {
		settings.profile_json = {};
	}

	settings.profile_json.name = profileName;
	settings.saveProfileData();
};

settings.readProfileData = () => {
	let particleDir = settings.ensureFolder();
	let proFile = path.join(particleDir, 'profile.json'); //proFile, get it?
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

settings.saveProfileData = () => {
	let particleDir = settings.ensureFolder();
	let proFile = path.join(particleDir, 'profile.json'); //proFile, get it?
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

settings.override = (profile, key, value) => {
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
