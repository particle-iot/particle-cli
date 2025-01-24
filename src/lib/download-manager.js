const { ensureFolder } = require('../../settings');
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
		const particleDir = ensureFolder();
		this.ui = ui;
		this._baseDir = path.join(particleDir, 'downloads');
		this._downloadDir = path.join(this._baseDir, 'files');
		this._ensureWorkDir();
	}

	get downloadDir() {
		return this._downloadDir;
	}

	_ensureWorkDir() {
		try {
			// Create the download directory if it doesn't exist
			fs.mkdirSync(this._downloadDir, { recursive: true });
		} catch (error) {
			this.ui.error(`Error creating directories: ${error.message}`);
			throw error;
		}
	}

	async _downloadFile(fileUrl, outputFileName, expectedChecksum) {
		const progressFilePath = path.join(this._downloadDir, `${outputFileName}.progress`);
		const finalFilePath = path.join(this._downloadDir, outputFileName);
		const progressBar = this.ui.createProgressBar();
		const url = fileUrl;
		// Check cache
		const cachedFile = await this._getCachedFile(outputFileName, expectedChecksum);
		if (cachedFile) {
			this.ui.write(`Using cached file: ${cachedFile}`);
			return cachedFile;
		}

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
				progressBar.start(totalBytes, downloadedBytes, { description: `Downloading ${outputFileName} ...` });
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
			// Validate checksum after download completes
			if (expectedChecksum) {
				const fileBuffer = fs.readFileSync(progressFilePath);
				const fileChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
				if (fileChecksum !== expectedChecksum) {
					await fs.remove(progressFilePath); // Delete the incomplete file if checksum fails
					throw new Error(`Checksum validation failed for ${outputFileName}`);
				}
			}
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
		const cachedFilePath = path.join(this._downloadDir, fileName);
		if (fs.existsSync(cachedFilePath)) {
			const fileBuffer = fs.readFileSync(cachedFilePath);
			const fileChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
			if (expectedChecksum && fileChecksum === expectedChecksum) {
				return cachedFilePath;
			} else {
				this.ui.write(`Cached file checksum mismatch for ${fileName}`);
				await fs.remove(cachedFilePath); // Remove the invalid cached file
				this.ui.write(`Removed invalid cached file: ${fileName}`);
			}
		}
		return null;
	}

	async cleanup({ fileName, cleanDownload = true } = {}) {
		try {
			if (fileName) {
				await fs.remove(path.join(this._downloadDir, fileName));
				await fs.remove(path.join(this._downloadDir, `${fileName}.progress`));
			} else if (cleanDownload) {
				await fs.remove(this._downloadDir);
			}
		} catch (error) {
			this.ui.error(`Error cleaning up directory: ${error.message}`);
			throw error;
		}
	}
}

module.exports = DownloadManager;
