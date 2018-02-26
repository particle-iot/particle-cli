/**
 ******************************************************************************
 * @file    commands/BinaryCommand.js
 * @author  Wojtek Siudzinski (wojtek@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    9-December-2015
 * @brief   Binary command module
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

const when = require('when');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Parser = require('binary-version-reader').HalModuleParser;
const utilities = require('../lib/utilities.js');

class BinaryCommand {
	constructor(options) {
		this.options = options;
	}

	inspectBinary() {
		const binaryFile = this.options.params.filename;

		if (!binaryFile || !fs.existsSync(binaryFile)) {
			console.error('Please specify a binary file');
			return when.reject();
		}
		const dfd = when.defer();
		const parser = new Parser();
		parser.parseFile(binaryFile, (fileInfo, err) => {
			if (err) {
				console.error(err);
				return dfd.reject();
			}

			if (fileInfo.suffixInfo.suffixSize === 65535) {
				console.error(binaryFile + ' does not contain inspection information');
				return dfd.reject();
			}

			console.log(chalk.bold(path.basename(binaryFile)));

			this._showCrc(fileInfo);
			this._showPlatform(fileInfo);
			this._showModuleInfo(fileInfo);

			dfd.resolve();
		});
		return dfd.promise;
	}

	_showCrc(fileInfo) {
		if (fileInfo.crc.ok) {
			console.log(chalk.green(' CRC is ok (' + fileInfo.crc.actualCrc + ')'));
		} else {
			console.log(chalk.red(' CRC failed (should be '
				+ chalk.bold(fileInfo.crc.storedCrc) + ' but is '
				+ chalk.bold(fileInfo.crc.actualCrc) + ')'));
		}
	}

	_showPlatform(fileInfo) {
		const platforms = utilities.knownPlatforms();
		let platformName;
		for (const k in platforms) {
			if (platforms[k] === fileInfo.prefixInfo.platformID) {
				platformName = k;
			}
		}
		if (platformName) {
			console.log(' Compiled for ' + chalk.bold(platformName));
		} else {
			console.log(' Compiled for unknown platform (ID: '
				+ chalk.bold(fileInfo.prefixInfo.platformID) + ')');
		}
	}

	_showModuleInfo(fileInfo) {
		const functions = [
			'an unknown module',
			'a reserved module',
			'a bootloader',
			'a monolithic firmware',
			'a system module',
			'an application module',
			'a settings module'
		];
		let moduleFunction = fileInfo.prefixInfo.moduleFunction;
		if (moduleFunction >= functions.length) {
			moduleFunction = 0;
		}
		console.log(' This is ' + chalk.bold(functions[moduleFunction])
			+ ' number ' + chalk.bold(fileInfo.prefixInfo.moduleIndex.toString())
			+ ' at version '
			+ chalk.bold(fileInfo.prefixInfo.moduleVersion.toString()));

		if (fileInfo.prefixInfo.depModuleFunction) {
			console.log(' It depends on '
				+ chalk.bold(functions[fileInfo.prefixInfo.depModuleFunction])
				+ ' number ' + chalk.bold(fileInfo.prefixInfo.depModuleIndex.toString())
				+ ' at version '
				+ chalk.bold(fileInfo.prefixInfo.depModuleVersion.toString()));
		}
	}
}

module.exports = BinaryCommand;
