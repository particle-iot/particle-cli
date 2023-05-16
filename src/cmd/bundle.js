const fs = require('fs-extra');
const path = require('path');
const CLICommandBase = require('./base');
const { createApplicationAndAssetBundle, unpackApplicationAndAssetBundle } = require('binary-version-reader');
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

		const bundle = await createApplicationAndAssetBundle(appBinary, assetsList);
		const bundleFilename = this._getBundleSavePath(saveTo, appBinary);
		await fs.promises.writeFile(bundleFilename, bundle);
		this.ui.stdout.write(`Success! Created bundle ${bundleFilename}\n`);

		// Get the list of bundled assets to display to the user
		const unpacked = await unpackApplicationAndAssetBundle(bundle);
		let bundledAssetsNames = [];
		unpacked.assets.forEach((asset) => {
			bundledAssetsNames.push(asset.name);
		});
		bundledAssetsNames = bundledAssetsNames.map((asset) => `- ${asset}`);
		this.ui.stdout.write(`Bundled assets:\n${bundledAssetsNames.join('\n')}\n`);
		return bundleFilename;
	}

	async getAssets(assets) {
		if (!await fs.exists(assets)) {
			throw new Error(`The folder ${assets} does not exist!`);
		}
		// Gets the assets only from the main folder and any sub-folders are ignored
		// 'assets' is the folder path of assets to be bundled
		const assetsInFolder = await fs.readdir(assets);
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
};
