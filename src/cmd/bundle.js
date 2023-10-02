const fs = require('fs-extra');
const path = require('path');
const CLICommandBase = require('./base');
const { createApplicationAndAssetBundle, unpackApplicationAndAssetBundle, createAssetModule } = require('binary-version-reader');
const utilities = require('../lib/utilities');
const os = require('os');
const temp = require('temp').track();
const { HalModuleParser } = require('binary-version-reader');
const deviceConstants = require('@particle/device-constants');

const platformsById = Object.values(deviceConstants).reduce((map, p) => map.set(p.id, p), new Map());
const MIN_ASSET_SUPPORT_VERSION = 5500;

const specialFiles = [
	'.DS_Store',
	'Thumbs.db',
	'desktop.ini',
	'__MACOSX'
];
module.exports = class BundleCommands extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	async createBundle({ saveTo, assets, params: { appBinary } }) {
		await this._checkAssetSupport();
		const { assetsPath, bundleFilename } = await this._validateArguments({ appBinary, saveTo, assets });
		const assetsList = await this._getAssets({ assetsPath });
		this._displayAssets({ appBinary, assetsPath, assetsList });
		await this._generateBundle({ assetsList, appBinary, bundleFilename });
		this._displaySuccess({ bundleFilename });

		return bundleFilename;
	}

	async _checkAssetSupport(appBinary) {
		const parser = new HalModuleParser();
		const { prefixInfo } = await parser.parseFile(appBinary);
		const platform = platformsById.get(prefixInfo.platformID);
		const version = prefixInfo.depModuleVersion;

		if (!platform.assets) {
			throw new Error('Assets not supported for this platform');
		}

		if (version < MIN_ASSET_SUPPORT_VERSION) {
			throw new Error('Asset support only available for device OS 5.5.0 and above');
		}
	}

	async _validateArguments({ appBinary, saveTo, assets }) {
		if (!await fs.exists(appBinary)) {
			throw new Error(`The file ${appBinary} does not exist`);
		} else if (utilities.getFilenameExt(appBinary) !== '.bin') {
			throw new Error(`The file ${appBinary} is not a valid binary`);
		} else if (saveTo && utilities.getFilenameExt(saveTo) !== '.zip') {
			throw new Error(`The target file ${saveTo} must be a .zip file`);
		}

		let assetsPath = await this._getAssetsPath(assets);
		const bundleFilename = this._getBundleSavePath(saveTo, appBinary);
		return { assetsPath, bundleFilename };
	}

	async _getAssetsPath(assets) {
		if (assets) {
			if (await fs.exists(assets)) {
				// check if assets is a project.properties file
				const stat = await fs.stat(assets);
				if (stat.isFile() && utilities.getFilenameExt(assets) === '.properties') {
					return this._getAssetsPathFromProjectProperties(assets);
				} else {
					return assets;
				}
			}
			throw new Error(`The assets dir ${assets} does not exist`);
		}
		const projectPropertiesPath = path.join(process.cwd(), 'project.properties');
		return this._getAssetsPathFromProjectProperties(projectPropertiesPath);
	}

	async _getAssetsPathFromProjectProperties(projectPropertiesPath) {
		if (!await fs.exists(projectPropertiesPath)) {
			throw new Error('No project.properties file found in the current directory. ' +
				'Please specify the assets directory using --assets option');
		}
		const propFile = await utilities.parsePropertyFile(projectPropertiesPath);
		if (propFile.assetOtaDir && propFile.assetOtaDir !== '') {
			// get the assets dir relative to the project.properties file
			return path.join(path.dirname(projectPropertiesPath), propFile.assetOtaDir);
		} else if (!propFile.assetOtaDir) {
			throw new Error('Add assetOtaDir to your project.properties in order to bundle assets');
		}
	}

	async _getAssets({ assetsPath }) {
		if (!await fs.exists(assetsPath)) {
			throw new Error(`The assets dir ${assetsPath} does not exist`);
		}
		const fileStat = await fs.stat(assetsPath);
		if (!fileStat.isDirectory()) {
			throw new Error(`The assets path ${assetsPath} is not a directory`);
		}
		// Only get the assets from the dir itself, ignoring any sub-dir
		const assetsInDir = await fs.readdir(assetsPath);
		const assetFiles = await Promise.all(assetsInDir.map(async (f) => {
			const filepath = path.join(assetsPath, f);
			const stat = await fs.stat(filepath);
			if (stat.isDirectory() || f.startsWith('.') || specialFiles.includes(f)) {
				return null;
			}
			return {
				data: await fs.readFile(filepath),
				name: f,
				path: path.join(assetsPath, f)
			};
		}));
		return assetFiles.filter(f => f !== null);
	}

	_getBundleSavePath(saveTo, appBinaryPath) {
		if (saveTo) {
			return saveTo;
		}
		const appBinaryName = path.basename(appBinaryPath);
		return `bundle_${utilities.filenameNoExt(appBinaryName)}_${Date.now()}.zip`;
	}

	_displayAssets({ appBinary, assetsPath, assetsList }) {
		this.ui.stdout.write(`Bundling ${appBinary} with ${assetsPath}:${os.EOL}`);
		assetsList.forEach((asset) => {
			this.ui.stdout.write(`  ${asset.name}${os.EOL}`);
		});
	}

	async _generateBundle({ assetsList, appBinary, bundleFilename }) {
		const bundle = await createApplicationAndAssetBundle(appBinary, assetsList);
		await fs.writeFile(bundleFilename, bundle);
		return bundle;
	}

	_displaySuccess({ bundleFilename }) {
		this.ui.stdout.write(`Bundling successful.${os.EOL}`);
		this.ui.stdout.write(`Saved bundle to: ${bundleFilename}${os.EOL}`);
	}

	async extractModulesFromBundle({ bundleFilename }) {
		const modulesDir = await temp.mkdir('modules');

		const { application, assets } = await unpackApplicationAndAssetBundle(bundleFilename);

		// Write the app binary and asset modules to disk
		application.path = path.join(modulesDir, application.name);
		await fs.writeFile(application.path, application.data);
		for (const asset of assets) {
			const assetModule = await createAssetModule(asset.data, asset.name);
			asset.path = path.join(modulesDir, asset.name);
			await fs.writeFile(asset.path, assetModule);
		}

		return [application.path, ...assets.map(asset => asset.path)];
	}
};
