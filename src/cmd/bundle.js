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
			const ext = utilities.getFilenameExt(appBinary).toLowerCase();
			if (ext !== '.bin') {
				throw new Error('The file ' + appBinary + ' is not a valid binary');
			}
		}
		const assetsList = fs.readdirSync(assets)
			.map(f => path.join(assets, f));
		const bundle = await createApplicationAndAssetBundle(appBinary, assetsList);
		const downloadFilename = await this._getDownloadBundlePath(saveTo, appBinary);
		await fs.writeFile(downloadFilename, bundle);
	}

	async _getDownloadBundlePath(saveTo, appBinaryPath) {
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
