const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const VError = require('verror');
const chalk = require('chalk');
const {
	HalModuleParser: Parser,
	unpackApplicationAndAssetBundle,
	isAssetValid,
	createProtectedModule,
	ModuleInfo,
	listModuleExtensions,
	removeModuleExtensions
} = require('binary-version-reader');
const utilities = require('../lib/utilities');
const ensureError = utilities.ensureError;
const filenameNoExt = utilities.filenameNoExt;

const INVALID_SUFFIX_SIZE = 65535;
const DEFAULT_PRODUCT_ID = 65535;
const DEFAULT_PRODUCT_VERSION = 65535;

const PROTECTED_MINIMUM_BOOTLOADER_VERSION = 3000;

class BinaryCommand {
	async inspectBinary(file) {
		await this._checkFile(file);
		const extractedFiles = await this._extractApplicationFiles(file);
		const parsedAppInfo = await this._parseBinary(extractedFiles.application);
		await this._showInspectOutput(parsedAppInfo);
		const assets = extractedFiles.assets;
		await this._verifyBundle(parsedAppInfo, assets);
	}

	async createProtectedBinary({ saveTo, file, verbose }) {
		await this._checkFile(file);
		const extractedFile = await this._extractFile(file);
		const binaryModule = await this._parseBinary(extractedFile);
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
		if (moduleFunction !== ModuleInfo.FunctionType.BOOTLOADER || moduleIndex !== 0 || moduleVersion < PROTECTED_MINIMUM_BOOTLOADER_VERSION) {
			throw new Error('Device protection feature is not supported for this binary.');
		}
	}

	async listAssetsFromApplication(file) {
		await this._checkFile(file);
		const extractedFile = await this._extractApplicationFiles(file);
		const parsedAppInfo = await this._parseBinary(extractedFile.application);

		const assets = await listModuleExtensions({
			module: parsedAppInfo.fileBuffer,
			exts: [ModuleInfo.ModuleInfoExtension.ASSET_DEPENDENCY]
		});

		//if no assets, print no assets
		if (assets.length === 0) {
			throw new Error('No assets found');
		}

		console.log('Assets found in ' + path.basename(file) + ':');
		for (const asset of assets) {
			console.log(' ' + chalk.bold(asset.name) + ' (' + asset.hash + ')');
		}
		console.log(os.EOL);

		return assets;

	}

	async stripAssetsFromApplication(file) {
		// Verify that the file exists and that it has assets
		this._checkFile(file);
		const extractedFile = await this._extractApplicationFiles(file);
		const parsedAppInfo = await this._parseBinary(extractedFile.application);

		const assets = await listModuleExtensions({
			module: parsedAppInfo.fileBuffer,
			exts: [ModuleInfo.ModuleInfoExtension.ASSET_DEPENDENCY]
		});

		//if no assets, print no assets
		if (assets.length === 0) {
			throw new Error('No assets found');
		}

		// Remove assets
		const appWithAssetsRemoved = await removeModuleExtensions({
			module: parsedAppInfo.fileBuffer,
			exts: [ModuleInfo.ModuleInfoExtension.ASSET_DEPENDENCY]
		});

		// Provide the path of the new application binary file with assets removed
		const outputFile = filenameNoExt(file) + '-no-assets.bin';
		await fs.writeFile(outputFile, appWithAssetsRemoved);
		console.log('Application binary without assets saved to ' + outputFile);
		console.log(os.EOL);
		return outputFile;
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

	async _showInspectOutput(appInfo) {
		const filename = path.basename(appInfo.filename);
		if (appInfo.suffixInfo.suffixSize === INVALID_SUFFIX_SIZE){
			throw new VError(`${filename} does not contain inspection information`);
		}
		console.log(chalk.bold(filename));
		this._showCrc(appInfo);
		this._showPlatform(appInfo);
		this._showModuleInfo(appInfo);
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
		if (appAssets) {
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

		if (fileInfo.suffixInfo.fwUniqueId) {
			console.log(' It has a ' + chalk.bold('UUID') + ' of '
			+ chalk.bold(fileInfo.suffixInfo.fwUniqueId.toString()));
		}
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
