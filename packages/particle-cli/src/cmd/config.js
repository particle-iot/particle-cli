const path = require('path');
const settings = require('../../settings');
const utilities = require('../lib/utilities');


module.exports = class ConfigCommand {
	constructor(options) {
		this.options = options;
	}

	configSwitch(profile, setting, value, { list }) {
		if (list) {
			this.listProfiles();
		} else if (setting) {
			this.changeSetting(profile === 'set' ? settings.profile : profile, setting, value);
		} else if (profile) {
			this.switchProfile(profile);
		} else {
			this.showProfile();
		}
	}

	switchProfile(profile) {
		settings.switchProfile(profile);
	}

	changeSetting(profile, name, value) {
		settings.override(profile, name, value);
	}

	showProfile() {
		console.log('Current profile: ' + settings.profile);
		console.log('Using API: ' + settings.apiUrl);
		if (settings.proxyUrl) {
			console.log('Proxy URL: ' + settings.proxyUrl);
		}
		console.log('Access token: ' + settings.access_token);
	}

	listProfiles() {
		const particleDir = settings.ensureFolder();
		const files = utilities.globList(null, [
			path.join(particleDir, '*.config.json')
		]);

		if (files.length > 0) {
			console.log('Available config files: ');
			for (let i = 0; i < files.length; i++) {

				//strip the path
				const filename = path.basename(files[i]);

				//strip the extension
				const name = filename.replace('.config.json', '');

				console.log((i + 1) + '.) ' + name);
			}
		} else {
			console.log('No configuration files found.');
		}
	}
};

