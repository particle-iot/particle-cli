'use strict';
const fs = require('fs');
const path = require('path');
const extend = require('xtend');
const _ = require('lodash');

let settings = {
	apiUrl: 'https://api.particle.io',
	get isStaging() {
		return this.apiUrl.includes('staging');
	},
	clientId: 'CLI2',
	access_token: null,
	username: null,
	minimumApiDelay: 500,
	useSudoForDfu: false,
	flashWarningShownOn: null,
	// TODO set to false once we give flags to control this
	disableUpdateCheck: envValueBoolean('PARTICLE_DISABLE_UPDATE', false),
	updateCheckInterval: 4 * 60 * 60 * 1000, // 4 hours
	updateCheckTimeout: 3000,
	// Auto-reauth: automatically re-login when token expires in interactive mode
	autoReauth: envValueBoolean('PARTICLE_AUTO_REAUTH', true),

	//10 megs -- this constant here is arbitrary
	MAX_FILE_SIZE: 1024 * 1024 * 10,

	wirelessSetupFilter: /^Photon-.*$/,

	serial_follow_delay: 250,
	manifestHost: envValue('PARTICLE_MANIFEST_HOST','binaries.particle.io'),

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

	cloudKnownApps: {
		'tinker': true
	},

	tachyonMeta: 'https://linux-dist.particle.io/meta',
	tachyonCacheLimitGB: 10
};

function envValue(varName, defaultValue) {
	const value = process.env[varName];
	return (typeof value === 'undefined') ? defaultValue : value;
}

function envValueBoolean(varName, defaultValue) {
	const value = envValue(varName);
	if (value === 'true' || value === 'TRUE' || value === '1') {
		return true;
	} else if (value === 'false' || value === 'FALSE' || value === '0') {
		return false;
	} else {
		return defaultValue;
	}
}

settings.findHomePath = () => {
	const envVars = [
		'home',
		'HOME',
		'HOMEPATH',
		'USERPROFILE'
	];

	for (let i = 0;i < envVars.length;i++) {
		const dir = process.env[envVars[i]];
		if (dir && fs.existsSync(dir)) {
			return dir;
		}
	}
	return __dirname;
};

settings.ensureFolder = () => {
	const particleDir = path.join(settings.findHomePath(), '.particle');
	if (!fs.existsSync(particleDir)) {
		fs.mkdirSync(particleDir);
	}
	return particleDir;
};

settings.findOverridesFile = (profile) => {
	profile = profile || settings.profile || 'particle';

	const particleDir = settings.ensureFolder();
	return path.join(particleDir, profile + '.config.json');
};

settings.loadOverrides = (profile) => {
	profile = profile || settings.profile || 'particle';

	try {
		const filename = settings.findOverridesFile(profile);
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
	const particleDir = settings.ensureFolder();
	const proFile = path.join(particleDir, 'profile.json'); //proFile, get it?
	if (fs.existsSync(proFile)) {
		try {
			const data = JSON.parse(fs.readFileSync(proFile));
			settings.profile = (data) ? data.name : 'particle';
			settings.profile_json = data;
		} catch (err) {
			throw new Error('Error parsing file ' + proFile + ': ' + err);
		}
	} else {
		settings.profile = 'particle';
		settings.profile_json = {};
	}
};

settings.saveProfileData = () => {
	const particleDir = settings.ensureFolder();
	const proFile = path.join(particleDir, 'profile.json'); //proFile, get it?
	fs.writeFileSync(proFile, JSON.stringify(settings.profile_json, null, 2), { mode: '600' });
};

settings.ssoAuthConfig = () => {
	const isProduction = settings.apiUrl === 'https://api.particle.io';
	if (isProduction) {
		return {
			ssoAuthUri: 'https://id.particle.io/oauth2/default/v1',
			ssoClientId: '0oa19uiy26XIs3XW55d7'
		};
	} else {
		return {
			ssoAuthUri: 'https://id.staging.particle.io/oauth2/default/v1',
			ssoClientId: '0oa19umyki69O4Kvb5d7'
		};
	}
};

// this is here instead of utilities to prevent a require-loop
// when files that utilties requires need settings
function matchKey(needle, obj, caseInsensitive) {
	needle = (caseInsensitive) ? needle.toLowerCase() : needle;
	for (const key in obj) {
		const keyCopy = (caseInsensitive) ? key.toLowerCase() : key;

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
		const realKey = matchKey(key, settings, true);
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
		const filename = settings.findOverridesFile(profile);
		fs.writeFileSync(filename, JSON.stringify(settings.overrides, null, 2), { mode: '600' });
	} catch (ex) {
		console.error('There was an error writing ' + settings.overrides + ': ', ex);
	}
};

module.exports = settings;
