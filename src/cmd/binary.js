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
const chalk = require('chalk');
const { HalModuleParser: Parser, unpackApplicationAndAssetBundle, isAssetValid, createProtectedModule, ModuleInfo } = require('binary-version-reader');
const utilities = require('../lib/utilities');
const ensureError = utilities.ensureError;

const INVALID_SUFFIX_SIZE = 65535;
const DEFAULT_PRODUCT_ID = 65535;
const DEFAULT_PRODUCT_VERSION = 65535;

const PROTECTED_MINIMUM_VERSION = '6.0.0';
const PROTECTED_MINIMUM_BOOTLOADER_VERSION = 3000;

class BinaryCommand {
	async inspectApplicationBinary(file) {
		await this._checkFile(file);
		const extractedFiles = await this._extractApplicationFiles(file);
		const parsedAppInfo = await this._parseApplicationBinary(extractedFiles.application);
		const assets = extractedFiles.assets;
		await this._verifyBundle(parsedAppInfo, assets);
	}

	async inspectBinary(file) {
		await this._checkFile(file);
		const extractedFiles = await this._extractFile(file);
		const parsedInfo = await this._parseBinary(extractedFiles.application);
		return parsedInfo;
	}

	async createProtectedBinary({ saveTo, file, verbose }) {
		await this._checkFile(file);
		const binaryModule = this.inspectBinary(file);
		this._validateProtectedBinary(binaryModule);
		let resBinaryName;

		if (saveTo) {
			resBinaryName = saveTo.endsWith('.bin') ? saveTo : `${saveTo}.bin`;
		} else {
			resBinaryName = path.basename(file).replace('.bin', '-protected.bin');
		}

		const resBinaryPath = path.join(path.dirname(file), resBinaryName);

		const binary = await fs.readFile(file);
		const protectedBinary = await createProtectedModule(binary);
		await fs.writeFile(resBinaryPath, protectedBinary);

		if (verbose) {
			console.log(`Protected binary saved at ${resBinaryPath}`);
		}

		return resBinaryPath;
	}

	_validateProtectedBinary(module) {
		const { moduleFunction, moduleVersion, moduleIndex } = module.prefixInfo;
		if (moduleFunction !== ModuleInfo.FunctionType.BOOTLOADER) {
			throw new Error('Device Protection can only be enabled on bootloaders. The file provided is not a bootloader.');
		}

		if (moduleIndex !== 0) {
			throw new Error('Device Protection can only be enabled on bootloaders with module index 0. Please use the correct bootloader file.');
		}

		if (moduleVersion < PROTECTED_MINIMUM_BOOTLOADER_VERSION) {
			throw new Error(`Device Protection can only be enabled on bootloader for device-os version ${PROTECTED_MINIMUM_VERSION} and later. The provided file is an older version.`);
		}
	}


	async _checkFile(file) {
		try {
			await fs.access(file);
		} catch (error) {
			throw new Error(`File does not exist: ${file}`);
		}
		return true;
	}

	async _extractApplicationFiles(file) {
		if (utilities.getFilenameExt(file) === '.zip') {
			return unpackApplicationAndAssetBundle(file);
		} else if (utilities.getFilenameExt(file) === '.bin') {
			const data = await fs.readFile(file);
			return { application: { name: path.basename(file), data }, assets: [] };
		} else {
			throw new VError(`File must be a .bin or .zip file: ${file}`);
		}
	}

	async _extractFile(file) {
		if (utilities.getFilenameExt(file) === '.bin') {
			const data = await fs.readFile(file);
			return { name: path.basename(file), data };
		} else {
			throw new VError(`File must be a .bin: ${file}`);
		}
	}

	async _parseApplicationBinary(applicationBinary) {
		const parser = new Parser();
		let fileInfo;
		try {
			fileInfo = await parser.parseBuffer({ filename: applicationBinary.name, fileBuffer: applicationBinary.data });
		} catch (err) {
			throw new VError(ensureError(err), `Could not parse ${applicationBinary.name}`);
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

	async _parseBinary(binary) {
		const parser = new Parser();
		let fileInfo;
		try {
			fileInfo = await parser.parseBuffer({ filename: binary.name, fileBuffer: binary.data });
			return fileInfo;
		} catch (err) {
			throw new VError(ensureError(err), `Could not parse ${binary.name}`);
		}
	}

	async _verifyBundle(appInfo, assets) {
		const appAssets = appInfo.assets;
		if (appAssets && assets.length > 0) {
			console.log('It depends on assets:');
			for (const appAsset of appAssets) {
				const asset = assets.find((bundleAsset) => bundleAsset.name === appAsset.name);
				if (asset) {
					const valid = isAssetValid(asset.data, appAsset);

					if (valid) {
						console.log(' ' + chalk.bold(appAsset.name) + ' (hash ' + appAsset.hash + ')');
					} else {
						console.log(chalk.red(' ' + appAsset.name + ' failed' + ' (hash should be ' + appAsset.hash + ')'));
					}
				} else {
					console.log(chalk.red(' ' + appAsset.name + ' failed' + ' (hash should be ' + appAsset.hash + ' but is not in the bundle)'));
				}
			}
		}
		return true;
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
