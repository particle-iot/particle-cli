const { ensureFolder } = require('../../settings');
const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');

class DownloadManager {
	/**
	 * @param {Object} channel
	 * @param {string} channel.name - The name of the channel
 	 * @param {string} channel.url - The URL of the channel
	 */
	constructor(channel) {
		const particleDir = ensureFolder();
		if (!channel) {
			throw new Error('Channel is required');
		}
		this.channel = channel;
		this._baseDir = path.join(particleDir, 'channels', this.channel.name);
		this._tempDir = path.join(this._baseDir, 'tmp');
		this._downloadDir = path.join(this._baseDir, 'downloads');
		this._ensureWorkDir();

	}

	get tempDir() {
		return this._tempDir;
	}

	get downloadDir() {
		return this._downloadDir;
	}

	_ensureWorkDir() {
		try {
			// Create the temp directory if it doesn't exist
			fs.mkdirSync(this._tempDir, { recursive: true });
			// Create the download directory if it doesn't exist
			fs.mkdirSync(this._downloadDir, { recursive: true });
		} catch (error) {
			console.error(`Error creating directories for channel "${this.channel.name}":`, error.message);
			throw error;
		}
	}

	async _downloadFile(fileUrl, outputFileName) {
		const tempFilePath = path.join(this._tempDir, outputFileName);
		const finalFilePath = path.join(this._downloadDir, outputFileName);
		const baseUrl = this.channel.url;
		const url = `${baseUrl}/${fileUrl}`;
		// TODO (hmontero): Implement cache for downloaded files
		const cachedFile = await this.getCachedFile(outputFileName);
		if (cachedFile) {
			console.log(`Using cached file: ${cachedFile}`);
			return cachedFile;
		}

		try {
			let downloadedBytes = 0;
			if (fs.existsSync(tempFilePath)) {
				downloadedBytes = fs.statSync(tempFilePath).size;
				console.log(`Resuming download from byte ${downloadedBytes}`);
			}

			const headers = downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {};
			const response = await fetch(url, { headers });

			if (!response.ok && response.status !== 206) {
				throw new Error(`Unexpected response status: ${response.status}`);
			}

			const writer = fs.createWriteStream(tempFilePath, { flags: 'a' });
			await new Promise((resolve, reject) => {
				response.body.pipe(writer);
				response.body.on('error', reject);
				writer.on('finish', resolve);
			});

			// Move temp file to final location
			fs.renameSync(tempFilePath, finalFilePath);
			console.log(`Download completed: ${finalFilePath}`);
		} catch (error) {
			console.error(`Error downloading file from ${url}:`, error.message);
			throw error;
		}
	}

	// eslint-disable-next-line no-unused-vars
	async getCachedFile(fileName) {
		return null;
	}

	async cleanup({ fileName, cleanTemp = true, cleanDownload = true } = {}) {
		try {
			if (fileName) {
				await fs.remove(path.join(this._downloadDir, fileName));
			} else {
				if (cleanTemp) {
					await fs.remove(this._tempDir);
				}
				if (cleanDownload) {
					await fs.remove(this._downloadDir);
				}
			}
		} catch (error) {
			console.error(`Error cleaning up temp directory for channel "${this.channel.name}":`, error.message);
			throw error;
		}
	}

}

module.exports = DownloadManager;
