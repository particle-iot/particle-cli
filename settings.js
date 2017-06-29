/**
 ******************************************************************************
 * @file    settings.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
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

var chalk = require('chalk');
var path = require('path');
var fs = require('fs');
var settings = require('particle-commands').settings;

function isTranslatingProfile() {
	console.log();
	console.log(chalk.yellow('!!!'), 'I detected a Spark profile directory, and will now migrate your settings.');
	console.log(chalk.yellow('!!!'), 'This will only happen once, since you previously used our Spark-CLI tools.');
	console.log();
}


var cliSettings = {
	commandPath: __dirname + '/commands/',
	clientId: 'CLI2',
	trackingApiKey:'p8DuwER9oRds1CTfL6FJrbYETYA1grCw',
	nativeModules: [
		'serialport'
	],
	showIncludedSourceFiles: true,
	commandMappings: path.join(__dirname, 'mappings.json'),
	minimumApiDelay: 500,
	//useOpenSSL: true,
	useSudoForDfu: false,
	// TODO set to false once we give flags to control this
	verboseOutput: true,
	disableUpdateCheck: false,
	updateCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
	updateCheckTimeout: 3000,

	//10 megs -- this constant here is arbitrary
	MAX_FILE_SIZE: 1024 * 1024 * 10,

	overridesFile: null,
	wirelessSetupFilter: /^Photon-.*$/,
};

function buildSettings() {
	var result = settings.buildSettings(false, cliSettings);
	result.get().disableUpdateCheck = result.envValueBoolean('PARTICLE_DISABLE_UPDATE', cliSettings.disableUpdateCheck);
	return result;
}

module.exports = buildSettings();
