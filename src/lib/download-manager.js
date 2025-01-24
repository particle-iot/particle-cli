const settings = require('../../settings');
const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');
const UI = require('./ui');
const crypto = require('crypto');

class DownloadManager {
	/**
	 * @param {UI} [ui] - The UI object to use for logging
	 */
	constructor(ui = new UI()) {
		const particleDir = settings.ensureFolder();
		this.ui = ui;
		this._baseDir = path.join(particleDir);
		this._downloadDir = path.join(this._baseDir, 'downloads');
		this._ensureWorkDir();
	}

	get downloadDir() {
		return this._downloadDir;
	}

	_ensureWorkDir() {
		try {
			// Create the download directory if it doesn't exist
			fs.mkdirSync(this.downloadDir, { recursive: true });
		} catch (error) {
			this.ui.error(`Error creating directories: ${error.message}`);
			throw error;
		}
	}

	async fetchManifest({ version = 'latest' }) {
		const metadataUrl = `${settings.tachyonMeta}/tachyon-${version}.json`;

		try {
			const response = await fetch(metadataUrl);
			if (!response.ok) {
				if (response.status === 404) {
					throw new Error('Version file not found. Please check the version number and try again.');
				} else {
					throw new Error('An error occurred while downloading the version file. Please try again later.');
				}
			}

			return response.json();
		} catch (err) {
			console.log(err);
			throw new Error('Could not download the version file. Please check your internet connection.');
		}
	}

	async download({ url, outputFileName, expectedChecksum }) {
		// Check cache
		const cachedFile = await this._getCachedFile(outputFileName, expectedChecksum);
		if (cachedFile) {
			this.ui.write(`Using cached file: ${cachedFile}`);
			return cachedFile;
		}
		const filePath = await this._downloadFile(url, outputFileName, expectedChecksum);
		// Validate checksum after download completes
		// Validate checksum after download completes
		try {
			if (expectedChecksum) {
				this._validateChecksum(filePath, expectedChecksum);
			}
		} catch (error) {
			// Remove the invalid file
			await fs.remove(filePath);
			this.ui.write(`Removed invalid downloaded file: ${outputFileName}`);
			throw error;
		}

		return filePath;
	}


	async _downloadFile(url, outputFileName) {
		const progressFilePath = path.join(this.downloadDir, `${outputFileName}.progress`);
		const finalFilePath = path.join(this.downloadDir, outputFileName);
		const progressBar = this.ui.createProgressBar();
		try {
			let downloadedBytes = 0;
			if (fs.existsSync(progressFilePath)) {
				downloadedBytes = fs.statSync(progressFilePath).size;
				this.ui.write(`Resuming download file: ${outputFileName}`);
			}

			const headers = downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {};
			const response = await fetch(url, { headers });

			if (!response.ok && response.status !== 206) {
				throw new Error(`Unexpected response status: ${response.status}`);
			}
			const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
			if (progressBar && totalBytes) {
				progressBar.start((totalBytes+downloadedBytes), downloadedBytes, { description: `Downloading ${outputFileName} ...` });
			}
			const writer = fs.createWriteStream(progressFilePath, { flags: 'a' });
			await new Promise((resolve, reject) => {
				response.body.on('data', (chunk) => {
					downloadedBytes += chunk.length;
					if (progressBar) {
						progressBar.increment(chunk.length);
					}
				});
				response.body.pipe(writer);
				response.body.on('error', reject);
				writer.on('finish', resolve);
			});
			// Rename progress file to final file
			fs.renameSync(progressFilePath, finalFilePath);
			this.ui.write(`Download completed: ${finalFilePath}`);
			return finalFilePath;
		} catch (error) {
			this.ui.error(`Error downloading file from ${url}: ${error.message}`);
			throw error;
		} finally {
			if (progressBar) {
				progressBar.stop();
			}
		}
	}

	async _getCachedFile(fileName, expectedChecksum) {
		const cachedFilePath = path.join(this.downloadDir, fileName);
		if (fs.existsSync(cachedFilePath)) {
			if (expectedChecksum) {
				try {
					this._validateChecksum(cachedFilePath, expectedChecksum);
					return cachedFilePath;
				} catch (error) {
					this.ui.write(`Cached file checksum mismatch for ${fileName}`);
					await fs.remove(cachedFilePath); // Remove the invalid cached file
					this.ui.write(`Removed invalid cached file: ${fileName}`);
				}
			}
		}
		return null;
	}

	_validateChecksum(filePath, expectedChecksum) {
		return new Promise((resolve, reject) => {
			const hash = crypto.createHash('sha256');
			const stream = fs.createReadStream(filePath);

			stream.on('data', (chunk) => hash.update(chunk));
			stream.on('end', () => {
				const fileChecksum = hash.digest('hex');
				if (fileChecksum !== expectedChecksum) {
					reject(new Error(`Checksum validation failed for ${path.basename(filePath)}. Expected: ${expectedChecksum}, Got: ${fileChecksum}`));
				} else {
					resolve();
				}
			});
			stream.on('error', (error) => {
				reject(new Error(`Error reading file for checksum validation: ${error.message}`));
			});
		});
	}

	async cleanup({ fileName, cleanInProgress = false, cleanDownload = true } = {}) {
		try {
			if (fileName) {
				// Remove specific file and its progress file
				await fs.remove(path.join(this.downloadDir, fileName));
				await fs.remove(path.join(this.downloadDir, `${fileName}.progress`));
			} else if (cleanInProgress) {
				// Remove all in-progress files
				const files = (await fs.readdir(this.downloadDir)).filter(file => file.endsWith('.progress'));
				await Promise.all(files.map(file => fs.remove(path.join(this.downloadDir, file))));
				files.forEach(file => this.ui.write(`Removed in-progress file: ${file}`));
				if (cleanDownload) {
					await fs.remove(this.downloadDir);
				}
			} else if (cleanDownload) {
				// Remove the entire download directory
				await fs.remove(this.downloadDir);
			}
		} catch (error) {
			this.ui.error(`Error cleaning up directory: ${error.message}`);
			throw error;
		}
	}
}

module.exports = DownloadManager;
