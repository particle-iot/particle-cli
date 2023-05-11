const fs = require('fs-extra');
const path = require('path');
const CLICommandBase = require('./base');
const { createApplicationAndAssetBundle } = require('binary-version-reader');
const utilities = require('../lib/utilities');
module.exports = class BundleCommands extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	async createBundle({ saveTo, assets, params: { appBinary } }) {
		if (!fs.existsSync(appBinary)) {
			throw new Error('The file ' + appBinary + ' does not exist!');
		} else {
			const ext = utilities.getFilenameExt(appBinary);
			if (ext !== '.bin') {
				throw new Error('The file ' + appBinary + ' is not a valid binary');
			}
		}

		if (!assets) {
			// If no assets folder is specified, use the default assets folder
			assets = path.join(process.cwd(), 'assets');
		}

		if (!fs.existsSync(assets)) {
			throw new Error('The folder ' + assets + ' does not exist!');
		}

		// Gets the assets only from the main folder and any sub-folders are ignored
		// 'assets' is the folder path of assets to be bundled
		const assetsInFolder = fs.readdirSync(assets).map(f => path.join(assets, f));
		if (assetsInFolder.length === 0) {
			throw new Error('No assets found in ' + assets);
		}

		const assetsList = assetsInFolder.map(f => { return { data: fs.readFileSync(f), name: path.basename(f) }});

		let downloadFilename;
		return createApplicationAndAssetBundle(appBinary, assetsList)
			.then((bundle) => {
				downloadFilename = this._getDownloadBundlePath(saveTo, appBinary);
				return fs.writeFile(downloadFilename, bundle);
			})
			.then(() => {
				this.ui.stdout.write(`Success! Downloaded bundle to ${downloadFilename}\n`);
				return downloadFilename;
			})
			.catch(err => {
				this.ui.stderr.write(err.message);
			});
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
