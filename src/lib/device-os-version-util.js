const { ensureFolder } = require('../../settings');
const deviceConstants = require('@particle/device-constants');
const path = require('path');
const os = require('os');
const request = require('request');
const fs = require('fs-extra');
const { HalModuleParser } = require('binary-version-reader');

/**
 * Download a file from the given url to the given directory
 * @param url - the url to download from
 * @param directory - the directory to download to
 * @param filename - the filename to use
 * @returns {Promise<unknown>} - a promise that resolves when the file is downloaded
 */
async function downloadFile({ url, directory, filename }) {
	let file;
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

				response.pipe(file);
				response.on('end', () => {
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
 * @returns {Promise<string>} - the path to the binary
 */
async function downloadBinary({ platformName, module, baseUrl, version }) {
	const binaryPath= getBinaryPath(version, platformName);
	// fetch the binary
	const url = `${baseUrl}/${module.filename}`;
	return downloadFile({
		url,
		directory: binaryPath,
		filename: module.filename
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

async function getCacheFile() {
	const particleDir = ensureFolder();
	const filePath =  path.join(particleDir, 'device-os-flash/binaries/device-os-version-cached.json');
	let data = [];
	try {
		const exists = await fs.pathExists(filePath);
		if (exists) {
			const fileContent = await fs.readFile(filePath, 'utf8');
			data = JSON.parse(fileContent);
		} else {
			await fs.writeJson(filePath, []);
		}

		return { data, cachePath: filePath };
	} catch (error) {
		// ignore
		throw new Error(`Error opening or creating the cache file: ${error.message}`);
	}
}

async function downloadCachedDeviceOsVersion({ api, platformId, version }) {
	let deviceOsVersion, cachedVersion, latest=false;
	const { data: cachedData, cachePath } = await getCacheFile();
	try {
		deviceOsVersion = await api.getDeviceOsVersions(platformId, version);
		if (version !== 'latest') {
			const latestDeviceOsVersion = await api.getDeviceOsVersions(platformId, 'latest');
			if (latestDeviceOsVersion.internal_version === deviceOsVersion.internal_version) {
				latest = true;
				// find the latest version in the cache and remove the flag
				const latestCachedVersion = cachedData.find(v => v.latest === true && v.platformId === platformId);
				if (latestCachedVersion && latestCachedVersion.version !== version) {
					latestCachedVersion.latest = false;
				}
			}
		} else {
			latest = true;
			const latestCachedVersion = cachedData.find(v => v.latest === true && v.platformId === platformId);
			if (latestCachedVersion && latestCachedVersion.version !== deviceOsVersion.version) {
				latestCachedVersion.latest = false;
			}
		}

		if (version === 'latest') {
			cachedVersion = cachedData.find(v => v.latest === true && v.platformId === platformId);
		} else {
			cachedVersion = cachedData.find(v => v.version === version && v.platformId === platformId);
		}

		if (!cachedVersion) {
			cachedData.push({
				platformId,
				version: deviceOsVersion.version,
				internal_version: deviceOsVersion.internal_version,
				base_url: deviceOsVersion.base_url,
				modules: deviceOsVersion.modules,
				latest
			});
		} else {
			cachedVersion.base_url = deviceOsVersion.base_url;
			cachedVersion.modules = deviceOsVersion.modules;
		}
		await fs.writeJson(cachePath, cachedData);
	} catch (error) {
		// check if the error is internet related
		if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND') || error.message.includes('Network error')) {
			let cachedVersion;
			// check if the version is cached
			if (version === 'latest') {
				cachedVersion = cachedData.find(v => v.latest === true && v.platformId === platformId);
			} else {
				cachedVersion = cachedData.find(v => v.version === version && v.platformId === platformId);
			}

			if (cachedVersion) {
				return cachedVersion;
			}
			throw new Error(`Device OS version not found in cache for platform: ${platformId} version: ${version} and there was an internet connection error`);

		}
		throw error;
	}

	return deviceOsVersion;
}

/**
 * Download the binaries for the given platform and version by default the latest version is downloaded
 * @param {Object} api - the api object
 * @param {number} platformId - the platform id
 * @param {string} version - the version to download (default: latest)
 * @param {Object} ui - allow us to interact in the console
 * @returns {Promise<*[]>} - true if successful
 */
async function downloadDeviceOsVersionBinaries({ api, platformId, version='latest', ui }){
	try {
		// get platform by id from device-constants
		const platform = Object.values(deviceConstants).filter(p => p.public).find(p => p.id === platformId);
		// get the device os versions
		const deviceOsVersion = await downloadCachedDeviceOsVersion({ api, platformId, version });
		// omit user part application
		deviceOsVersion.modules = deviceOsVersion.modules.filter(m => m.prefixInfo.moduleFunction !== 'user_part');

		// find the modules that don't already exist on this machine
		const modulesToDownload = [];
		for (const module of deviceOsVersion.modules) {
			const isDownloaded = await isModuleDownloaded(module, deviceOsVersion.version, platform.name);
			if (!isDownloaded) {
				modulesToDownload.push(module);
			}
		}

		// download binaries for each missing module
		if (modulesToDownload.length > 0) {
			const description = `Downloading Device OS ${version}`;

			await ui.showBusySpinnerUntilResolved(description, Promise.all(modulesToDownload.map(async (module) => {
				await downloadBinary({
					platformName: platform.name,
					module,
					baseUrl: deviceOsVersion.base_url,
					version: deviceOsVersion.version
				});
			})));
			ui.stdout.write(`Downloaded Device OS ${version}${os.EOL}`);
		}

		const binaryPath = getBinaryPath(deviceOsVersion.version, platform.name);
		return deviceOsVersion.modules.map(m => path.join(binaryPath, m.filename));
	} catch (error) {
		if (error.message.includes('404')) {
			throw new Error(`Device OS version not found for platform: ${platformId} version: ${version}`);
		}
		throw error;
	}

}

module.exports = {
	downloadDeviceOsVersionBinaries
};
