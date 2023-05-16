const fs = require('fs-extra');
const path = require('path');
const CLICommandBase = require('./base');
const { createApplicationAndAssetBundle } = require('binary-version-reader');
const utilities = require('../lib/utilities');

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

		// If no assets folder is specified, use the default assets folder in the current directory
		let assetsPath = assets ? assets : 'assets';

		const bundleFilename = this._getBundleSavePath(saveTo, appBinary);
		return { assetsPath, bundleFilename };
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
				name: f
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
		this.ui.stdout.write(`Bundling ${appBinary} with ${assetsPath}:\n`);
		assetsList.forEach((asset) => {
			this.ui.stdout.write(`  ${asset.name}\n`);
		});
	}

	async _generateBundle({ assetsList, appBinary, bundleFilename }) {
		const bundle = await createApplicationAndAssetBundle(appBinary, assetsList);
		await fs.writeFile(bundleFilename, bundle);
	}

	_displaySuccess({ bundleFilename }) {
		this.ui.stdout.write(`Bundle ${bundleFilename} successfully generated\n`);
	}
};
