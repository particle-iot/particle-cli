const { ensureFolder } = require('../../settings');
const deviceConstants = require('@particle/device-constants');
const path = require('path');
const request = require('request');
const fs = require('fs-extra');

/**
 * Download a file from the given url to the given directory
 * @param url - the url to download from
 * @param directory - the directory to download to
 * @param filename - the filename to use
 * @returns {Promise<unknown>} - a promise that resolves when the file is downloaded
 */
function downloadFile(url, directory, filename) {
	return new Promise(async (resolve, reject) => {
		filename = filename || url.match(/.*\/(.*)/)[1];
		console.log('Downloading ' + filename + '...');
		await fs.ensureDir(directory);
		let file = fs.createWriteStream(directory + '/' + filename);
		file.on('finish', () => {
			file.close(() => {
				resolve(directory + '/' + filename);
			});
		});
		request
			.get(url)
			.pipe(file)
			.on('error', (err) => {
				file.close();
				reject(err);
			});
	});
}

/**
 * Download the binary for the given platform and module
 * @param api - the api object
 * @param platformName - the platform name
 * @param module - the module object to download
 * @param baseUrl - the base url for the api
 * @returns {Promise<string>} - the path to the binary
 */
const downloadBinary = async ({ platformName, module, baseUrl, version }) => {
	const basePath = ensureFolder();
	const binaryPath = path.join(basePath, 'device-os-flash/binaries/', version, platformName);
	// fetch the binary
	const uri = `${baseUrl}/${module.filename}`;
	return downloadFile(uri, binaryPath, module.filename);
};

/**
 * Download the binaries for the given platform and version by default the latest version is downloaded
 * @param {Object} api - the api object
 * @param {number} platformId - the platform id
 * @param {string} version - the version to download (default: latest)
 * @returns {Promise<*[]>} - true if successful
 */
const downloadDeviceOsVersionBinaries = async ({ api, platformId, version='latest' }) => {
	try {
		const downloadedBinaries = [];
		// get platform by id from device-constants
		const platform = Object.values(deviceConstants).filter(p => p.public).find(p => p.id === platformId);
		// get the device os versions
		console.log('Getting device os version data for platform: ' + platformId + ' version: ' + version + '...');
		const deviceOsVersion = await api.getDeviceOsVersions(platformId, version);
		// download binaries for each module in the device os version
		for await (const module of deviceOsVersion.modules) {
			downloadedBinaries.push(await downloadBinary({
				platformName: platform.name,
				module,
				baseUrl: deviceOsVersion.base_url,
				version: deviceOsVersion.version
			}));
		}
		return downloadedBinaries;
	} catch (error) {
		if (error.message.includes('404')) {
			throw new Error(`Device OS version not found for platform: ${platformId} version: ${version}`);
		}
		throw new Error('Error downloading binaries for platform: ' + platformId + ' version: ' + version + ' error: ' + error.message);
	}

};

module.exports = {
	downloadDeviceOsVersionBinaries
};
