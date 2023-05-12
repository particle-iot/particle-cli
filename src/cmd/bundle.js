const fs = require('fs-extra');
const path = require('path');
const CLICommandBase = require('./base');
const { createApplicationAndAssetBundle } = require('binary-version-reader');
const utilities = require('../lib/utilities');

const specialFiles = [
	'.DS_Store',
	'Thumbs.db',
	'desktop.ini',
	'Icon\r',
	'__MACOSX'
];
module.exports = class BundleCommands extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	async createBundle({ saveTo, assets, params: { appBinary } }) {

		if (!await fs.exists(appBinary)) {
			throw new Error(`The file ${appBinary} does not exist`);
		} else if (utilities.getFilenameExt(appBinary) !== '.bin') {
			throw new Error(`The file ${appBinary} is not a valid binary`);
		}

		if (!assets) {
			// If no assets folder is specified, use the default assets folder
			assets = path.join(process.cwd(), 'assets');
		}

		const assetsList = await this.getAssets(assets);

		let downloadFilename;
		try {
			const bundle = await createApplicationAndAssetBundle(appBinary, assetsList);
			downloadFilename = this._getDownloadBundlePath(saveTo, appBinary);
			await fs.promises.writeFile(downloadFilename, bundle);
			this.ui.stdout.write(`Success! Created bundle ${downloadFilename}\n`);
			return downloadFilename;
		} catch (error) {
			throw new Error(error);
		}
	}

	async getAssets(assets) {
		if (!await fs.exists(assets)) {
			throw new Error(`The folder ${assets} does not exist!`);
		}
		// Gets the assets only from the main folder and any sub-folders are ignored
		// 'assets' is the folder path of assets to be bundled
		const assetsInFolder = await fs.readdir(assets);	// .map(f => path.join(assets, f));
		const assetFiles = await Promise.all(assetsInFolder.map(async (f) => {
			const filepath = path.join(assets, f);
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

	_getDownloadBundlePath(saveTo, appBinaryPath) {
		if (saveTo){
			const ext = utilities.getFilenameExt(saveTo);
			if (ext === '.zip') {
				return saveTo;
			}
		}
		const appBinaryName = path.basename(appBinaryPath);
		return 'bundle_' + utilities.filenameNoExt(appBinaryName) + '_' + Date.now() + '.zip';
	}
};
