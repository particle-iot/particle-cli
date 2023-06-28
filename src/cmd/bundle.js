const fs = require('fs-extra');
const path = require('path');
const CLICommandBase = require('./base');
const { createApplicationAndAssetBundle } = require('binary-version-reader');
const utilities = require('../lib/utilities');
const os = require('os');

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
		const { assetsPath, bundleFilename } = await this._validateArguments({ appBinary, saveTo, assets });
		const assetsList = await this._getAssets({ assetsPath });
		this._displayAssets({ appBinary, assetsPath, assetsList });
		await this._generateBundle({ assetsList, appBinary, bundleFilename });
		this._displaySuccess({ bundleFilename });

		return bundleFilename;
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
			throw new Error(`The assets folder ${assets} does not exist`);
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
		if (propFile.assetOtaFolder && propFile.assetOtaFolder !== '') {
			// get the assets folder relative to the project.properties file
			const assetsDir = path.join(path.dirname(projectPropertiesPath), propFile.assetOtaFolder);
			const stats = await fs.stat(assetsDir);
			if (stats.isDirectory()) {
				return path.basename(assetsDir);
			}
		}
	}

	async _getAssets({ assetsPath }) {
		if (!await fs.exists(assetsPath)) {
			throw new Error(`The assets folder ${assetsPath} does not exist`);
		}
		// Only get the assets from the folder itself, ignoring any sub-folders
		const assetsInFolder = await fs.readdir(assetsPath);
		const assetFiles = await Promise.all(assetsInFolder.map(async (f) => {
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
};
