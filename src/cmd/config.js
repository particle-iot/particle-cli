/**
 ******************************************************************************
 * @file    commands/ConfigCommand.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Config commands module
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

const settings = require('../../settings.js');
const path = require('path');

const utilities = require('../lib/utilities.js');

class ConfigCommand {
	constructor(options) {
		this.options = options;
	}

	configSwitch() {
		const profile = this.options.params.profile;
		const setting = this.options.params.setting;
		const value = this.options.params.value;
		const list = this.options.list;

		if (list) {
			this.listProfiles();
		} else if (setting) {
			this.changeSetting(profile, setting, value);
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
}

module.exports = ConfigCommand;
