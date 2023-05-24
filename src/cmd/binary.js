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

const fs = require('fs-extra');
const path = require('path');
const VError = require('verror');
const crypto = require('crypto');
const chalk = require('chalk');
const Parser = require('binary-version-reader').HalModuleParser;
const utilities = require('../lib/utilities');
const ensureError = utilities.ensureError;
const decompress = require('decompress');

const INVALID_SUFFIX_SIZE = 65535;
const DEFAULT_PRODUCT_ID = 65535;
const DEFAULT_PRODUCT_VERSION = 65535;
let tmpDir;

class BinaryCommand {
	async inspectBinary(file) {
		await this._checkFile(file);
		const [binaryFile, assets] = await this._extractFiles(file);
		const parsedBinaryInfo = await this._parseBinaryFile(binaryFile);
		await this._verifyBundle(parsedBinaryInfo, assets);
		await this._cleanup(tmpDir);
	}

	async _checkFile(file) {
		try {
			await fs.access(file);
		} catch (error) {
			throw new Error(`File does not exist: ${file}`);
		}
		return true;
	}

	async _extractFiles(file) {
		if (utilities.getFilenameExt(file) !== '.bin' && utilities.getFilenameExt(file) !== '.zip') {
			throw new VError(`File must be a .bin or .zip file: ${file}`);
		}

		if (utilities.getFilenameExt(file) === '.zip') {
			let binaryFile;
			let assets = [];
			const unzipped = await this._extractZip(file);

			const files = await fs.readdir(unzipped);
			for (const file of files) {
				if (file === 'assets') {
					const fullPathAssets = path.join(unzipped,file);
					if ((await fs.stat(fullPathAssets)).isDirectory()) {
						const assetFiles = await fs.readdir(fullPathAssets);
						assetFiles.forEach((assetFile) => {
							assets.push(path.join(fullPathAssets, assetFile));
						});
					}
				}
				if (utilities.getFilenameExt(file) === '.bin') {
					binaryFile = path.join(unzipped, file);
				}
			}
			return [binaryFile, assets];
		} else {
			return [file, []];
		}
	}

	async _extractZip(file) {
		if (utilities.getFilenameExt(file) !== '.zip') {
			throw new VError(`File must be a .zip file: ${file}`);
		}

		tmpDir = await fs.mkdtemp('temp-dir-for-assets');
		try {
			await decompress(file, tmpDir);
			return tmpDir;
		} catch (err) {
			throw new VError(ensureError(err), `Could not extract ${file}`);
		}
	}

	async _parseBinaryFile(file) {
		await this._checkFile(file);
		if (utilities.getFilenameExt(file) !== '.bin') {
			throw new VError(`File must be a .bin file: ${file}`);
		}
		const parser = new Parser();
		let fileInfo;
		try {
			fileInfo = await parser.parseFile(file);
		} catch (err) {
			throw new VError(ensureError(err), `Could not parse ${file}`);
		}

		const filename = path.basename(fileInfo.filename);
		if (fileInfo.suffixInfo.suffixSize === INVALID_SUFFIX_SIZE){
			throw new VError(`${filename} does not contain inspection information`);
		}
		console.log(chalk.bold(filename));
		this._showCrc(fileInfo);
		this._showPlatform(fileInfo);
		this._showModuleInfo(fileInfo);
		return fileInfo;
	}

	async _verifyBundle(binaryFileInfo, assets) {
		const assetNames = assets.map((asset) => {
			return path.basename(asset);
		});

		if (binaryFileInfo.assets){
			console.log('It depends on assets:');
			let assetHashes = {};
			for (const asset of binaryFileInfo.assets) {
				assetHashes[asset.name] = asset.hash;
				if (assetNames.includes(asset.name)) {
					const file = assets.find((file) => {
						return path.basename(file) === asset.name;
					});
					const fileRead = await fs.readFile(file);
					const hash = this._getHash(fileRead);
					if (asset.hash === hash) {
						console.log(' ' + chalk.bold(asset.name) + ' in bundle' + ' (hash ' + asset.hash + ')');
					} else if (asset.hash !== hash) {
						console.log(chalk.red(' ' + asset.name + ' failed' + ' (hash should be ' + asset.hash + ' but is ' + hash + ')'));
					}
				} else {
					console.log(chalk.red(' ' + asset.name + ' failed' + ' (hash should be ' + asset.hash + ' but is not in the bundle)'));
				}
			}
			return true;
		}
	}

	_getHash(file) {
		return crypto.createHash('sha256').update(file).digest('hex');
	}

	async _cleanup(tmpDir) {
		if (tmpDir) {
			await fs.remove(tmpDir);
		}
	}

	_showCrc(fileInfo){
		if (fileInfo.crc.ok){
			console.log(chalk.green(' CRC is ok (' + fileInfo.crc.actualCrc + ')'));
		} else {
			console.log(chalk.red(' CRC failed (should be '
				+ chalk.bold(fileInfo.crc.storedCrc) + ' but is '
				+ chalk.bold(fileInfo.crc.actualCrc) + ')'));
		}
	}

	_showPlatform(fileInfo){
		const platforms = utilities.knownPlatformIds();
		let platformName;

		for (const k in platforms){
			if (platforms[k] === fileInfo.prefixInfo.platformID){
				platformName = k;
			}
		}

		if (platformName){
			console.log(' Compiled for ' + chalk.bold(platformName));
		} else {
			console.log(' Compiled for unknown platform (ID: '
				+ chalk.bold(fileInfo.prefixInfo.platformID) + ')');
		}
	}

	_showModuleInfo(fileInfo){
		const functions = [
			'an unknown module',
			'a reserved module',
			'a bootloader',
			'a monolithic firmware',
			'a system module',
			'an application module',
			'a settings module',
			'a network coprocessor (NCP) module',
			'a radio stack module'
		];
		let moduleFunction = fileInfo.prefixInfo.moduleFunction;

		if (moduleFunction >= functions.length){
			moduleFunction = 0;
		}
		console.log(' This is ' + chalk.bold(functions[moduleFunction])
			+ ' number ' + chalk.bold(fileInfo.prefixInfo.moduleIndex.toString())
			+ ' at version '
			+ chalk.bold(fileInfo.prefixInfo.moduleVersion.toString()));

		if (fileInfo.suffixInfo.productId !== DEFAULT_PRODUCT_ID &&
			fileInfo.suffixInfo.productVersion !== DEFAULT_PRODUCT_VERSION) {
			console.log(' It is firmware for '
				+ chalk.bold('product id ' + fileInfo.suffixInfo.productId)
				+ ' at version '
				+ chalk.bold(fileInfo.suffixInfo.productVersion));
		}

		if (fileInfo.prefixInfo.depModuleFunction){
			console.log(' It depends on '
				+ chalk.bold(functions[fileInfo.prefixInfo.depModuleFunction])
				+ ' number ' + chalk.bold(fileInfo.prefixInfo.depModuleIndex.toString())
				+ ' at version '
				+ chalk.bold(fileInfo.prefixInfo.depModuleVersion.toString()));
		}

		if (fileInfo.prefixInfo.dep2ModuleFunction){
			console.log(` It ${fileInfo.prefixInfo.depModuleFunction ? 'also ' : ''}depends on `
				+ chalk.bold(functions[fileInfo.prefixInfo.dep2ModuleFunction])
				+ ' number ' + chalk.bold(fileInfo.prefixInfo.dep2ModuleIndex.toString())
				+ ' at version '
				+ chalk.bold(fileInfo.prefixInfo.dep2ModuleVersion.toString()));
		}
	}
}

module.exports = BinaryCommand;
