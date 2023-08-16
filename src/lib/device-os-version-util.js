const { ensureFolder } = require('../../settings');
const deviceConstants = require('@particle/device-constants');
const path = require('path');
const request = require('request');
const fs = require('fs-extra');
const { HalModuleParser } = require('binary-version-reader');

/**
 * Download a file from the given url to the given directory
 * @param url - the url to download from
 * @param directory - the directory to download to
 * @param filename - the filename to use
 * @param progressBar - an instance of ProgressBar to use for progress updates
 * @returns {Promise<unknown>} - a promise that resolves when the file is downloaded
 */
async function downloadFile({ url, directory, filename, progressBar }) {
	let file, totalBytes = 0;
	try {
		filename = filename || url.match(/.*\/(.*)/)[1];
		await fs.ensureDir(directory);
		file = fs.createWriteStream(directory + '/' + filename);
		await new Promise((resolve, reject) => {
			file.on('error', (error) => {
				reject(error);
			});
			file.on('finish', () => {
				resolve();
			});
			const req = request.get(url);
			req.on('response', (response) => {
				if (response.statusCode !== 200) {
					req.abort();
					reject(new Error('Failed to download file: ' + response.statusCode));
				}
				totalBytes = parseInt(response.headers['content-length'], 10);
				if (progressBar) {
					progressBar.description = filename;
					progressBar.start(totalBytes, 0);
				}
				response.pipe(file);
				response.on('data', (chunk) => {
					if (progressBar) {
						progressBar.increment(chunk.length);
					}
				});
				response.on('end', () => {
					if (progressBar) {
						progressBar.stop();
					}
					file.end();
					resolve(filename);
				});
			});

			req.on('error', (err) => {
				reject(err);
			});
		});
		return filename;
	} finally {
		if (file) {
			file.end();
		}
	}

}

/**
 * Get the path to the binaries for the given version and platform
 * @param version - the version to get the path for
 * @param platformName - the platform name to get the path for
 * @returns {string} - the path to the binaries
 */
function getBinaryPath(version, platformName) {
	const particleDir = ensureFolder();
	return path.join(particleDir, 'device-os-flash/binaries/', version, platformName);
}
/**
 * Download the binary for the given platform and module
 * @param api - the api object
 * @param platformName - the platform name
 * @param module - the module object to download
 * @param baseUrl - the base url for the api
 * @param version - the version to download
 * @param progressBar - an instance of ProgressBar to use for progress updates
 * @returns {Promise<string>} - the path to the binary
 */
async function downloadBinary({ platformName, module, baseUrl, version, progressBar }) {
	const binaryPath= getBinaryPath(version, platformName);
	// fetch the binary
	const url = `${baseUrl}/${module.filename}`;
	return downloadFile({
		url,
		directory: binaryPath,
		filename: module.filename,
		progressBar
	});
}

async function isModuleDownloaded(module, version, platformName) {
	// check if the module is already downloaded
	const binaryPath = getBinaryPath(version, platformName);
	const filePath = path.join(binaryPath, module.filename);
	try {
		const exits = await fs.pathExists(filePath);
		if (exits) {
			const parser = new HalModuleParser();
			const info = await parser.parseFile(filePath);
			return info.crc.storedCrc === module.crc.storedCrc && info.crc.actualCrc === module.crc.actualCrc;
		}
		return false;
	} catch (error) {
		return false;
	}
}

/**
 * Download the binaries for the given platform and version by default the latest version is downloaded
 * @param {Object} api - the api object
 * @param {number} platformId - the platform id
 * @param {string} version - the version to download (default: latest)
 * @param {Object} ui - allow us to interact in the console
 * @returns {Promise<*[]>} - true if successful
 */
async function downloadDeviceOsVersionBinaries({ api, platformId, version='latest', ui, omitUserPart=false }){
	try {
		const downloadedBinaries = [];
		// get platform by id from device-constants
		const platform = Object.values(deviceConstants).filter(p => p.public).find(p => p.id === platformId);
		// get the device os versions
		const deviceOsVersion = await api.getDeviceOsVersions(platformId, version);
		if (omitUserPart) {
			deviceOsVersion.modules = deviceOsVersion.modules.filter(m => m.prefixInfo.moduleFunction !== 'user_part');
		}

		// download binaries for each module in the device os version
		for await (const module of deviceOsVersion.modules) {
			//TODO (hmontero) - make sure downloadedBinaries returns the full path to the binary
			const isDownloaded = await isModuleDownloaded(module, deviceOsVersion.version, platform.name);
			const binaryPath = getBinaryPath(deviceOsVersion.version, platform.name);
			if (!isDownloaded) {
				let progressBar;
				// if is in silent mode don't create a progress bar
				if (global.isInteractive) {
					progressBar = ui.createProgressBar(`Downloading ${module.filename}`);
				} else {
					ui.write(`Downloading ${module.filename}`);
				}
				const downloadedBinaryName = await downloadBinary({
					platformName: platform.name,
					module,
					baseUrl: deviceOsVersion.base_url,
					version: deviceOsVersion.version,
					progressBar,
				});
				downloadedBinaries.push(path.join(binaryPath, downloadedBinaryName));
			} else {
				downloadedBinaries.push(path.join(binaryPath, module.filename));
			}
		}
		return downloadedBinaries;
	} catch (error) {
		if (error.message.includes('404')) {
			throw new Error(`Device OS version not found for platform: ${platformId} version: ${version}`);
		}
		throw new Error('Error downloading binaries for platform: ' + platformId + ' version: ' + version + ' error: ' + error.message);
	}

}

module.exports = {
	downloadDeviceOsVersionBinaries
};
