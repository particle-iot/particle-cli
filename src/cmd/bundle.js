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

	async createBundle({ saveTo, assets: assetsPath, params: { appBinary } }) {
		if (!await fs.exists(appBinary)) {
			throw new Error(`The file ${appBinary} does not exist`);
		} else if (utilities.getFilenameExt(appBinary) !== '.bin') {
			throw new Error(`The file ${appBinary} is not a valid binary`);
		}

		if (!assetsPath) {
			// If no assets folder is specified, use the default assets folder
			assetsPath = path.join(process.cwd(), 'assets');
		}

		const { bundleFilename, assetsList } = await this._generateBundle({ assetsPath, appBinary, saveTo });
		this._displayAssets({ assetsPath, bundleFilename, assetsList });

		return bundleFilename;
	}

	async _generateBundle({ assetsPath, appBinary, saveTo }) {
		const assetsList = await this._getAssets(assetsPath);
		const bundle = await createApplicationAndAssetBundle(appBinary, assetsList);
		const bundleFilename = this._getBundleSavePath(saveTo, appBinary);
		await fs.writeFile(bundleFilename, bundle);
		return { bundleFilename, assetsList };
	}

	async _getAssets(assetsPath) {
		if (!await fs.exists(assetsPath)) {
			throw new Error(`The folder ${assetsPath} does not exist!`);
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
		if (saveTo){
			const ext = utilities.getFilenameExt(saveTo);
			if (ext === '.zip') {
				return saveTo;
			}
		}
		const appBinaryName = path.basename(appBinaryPath);
		return 'bundle_' + utilities.filenameNoExt(appBinaryName) + '_' + Date.now() + '.zip';
	}

	_displayAssets({ assetsPath, bundleFilename, assetsList }) {

	}
};
