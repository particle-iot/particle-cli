const { ensureFolder } = require('../../settings');
const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');
const UI = require('./ui');
const crypto = require('crypto');

class DownloadManager {
	/**
	 * @param {Object} channel
	 * @param {string} channel.name - The name of the channel
 	 * @param {string} channel.url - The URL of the channel
	 * @param {UI} [ui] - The UI object to use for logging
	 */
	constructor(channel, ui = new UI()) {
		const particleDir = ensureFolder();
		if (!channel) {
			throw new Error('Channel is required');
		}
		this.ui = ui;
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
			this.ui.error(`Error creating directories for channel "${this.channel.name}": ${error.message}`);
			throw error;
		}
	}

	async _downloadFile(fileUrl, outputFileName, expectedChecksum) {
		const tempFilePath = path.join(this._tempDir, outputFileName);
		const finalFilePath = path.join(this._downloadDir, outputFileName);
		const baseUrl = this.channel.url;
		const progressBar = this.ui.createProgressBar();
		const url = `${baseUrl}/${fileUrl}`;
		// TODO (hmontero): Implement cache for downloaded files
		const cachedFile = await this.getCachedFile(outputFileName);
		if (cachedFile) {
			this.ui.write(`Using cached file: ${cachedFile}`);
			return cachedFile;
		}

		try {
			let downloadedBytes = 0;
			if (fs.existsSync(tempFilePath)) {
				downloadedBytes = fs.statSync(tempFilePath).size;
				this.ui.write(`Resuming download file: ${outputFileName}`);
			}

			const headers = downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {};
			const response = await fetch(url, { headers });

			if (!response.ok && response.status !== 206) {
				throw new Error(`Unexpected response status: ${response.status}`);
			}
			const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
			if (progressBar && totalBytes) {
				progressBar.start(totalBytes, downloadedBytes, { description: `Downloading ${outputFileName} ...` });
			}
			const writer = fs.createWriteStream(tempFilePath, { flags: 'a' });
			await new Promise((resolve, reject) => {
				const hash = crypto.createHash('sha256');
				response.body.on('data', (chunk) => {
					downloadedBytes += chunk.length;
					hash.update(chunk);
					if (progressBar) {
						progressBar.increment(chunk.length);
					}
				});
				response.body.pipe(writer);
				response.body.on('error', reject);
				writer.on('finish', async () => {
					const fileChecksum = hash.digest('hex');
					if (expectedChecksum && fileChecksum !== expectedChecksum) {
						// if we don't remove the file, the next time we try to download it, it will be resumed
						await fs.remove(tempFilePath);
						return reject(new Error(`Checksum validation failed for ${outputFileName}`));
					}
					resolve();
				});
			});
			// Move temp file to final location
			fs.renameSync(tempFilePath, finalFilePath);
			this.ui.write(`Download completed: ${finalFilePath}`);
		} catch (error) {
			this.ui.error(`Error downloading file from ${url}: ${error.message}`);
			throw error;
		} finally {
			if (progressBar) {
				progressBar.stop();
			}
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
			this.ui.error(`Error cleaning up temp directory for channel "${this.channel.name}": ${error.message}`);
			throw error;
		}
	}

}

module.exports = DownloadManager;
