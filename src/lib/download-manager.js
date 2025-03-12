const settings = require('../../settings');
const fs = require('fs-extra');
const path = require('path');
const fetch = require('node-fetch');
const UI = require('./ui');
const crypto = require('crypto');
const { delay } = require('./utilities');

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

	async fetchManifest({ version = 'latest', isRb3Board = false }) {
		const type = isRb3Board ? 'rb3g2' : 'tachyon';
		const metadataUrl = `${settings.tachyonMeta}/${type}-${encodeURIComponent(version)}.json`;

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

	async download({ url, outputFileName, expectedChecksum, options = {} }) {
		// Check cache
		const { alwaysCleanCache = false } = options;
		const cachedFile = await this._getCachedFile(outputFileName, expectedChecksum);
		if (cachedFile) {
			this.ui.write(`Using cached file: ${cachedFile}`);
			return cachedFile;
		}
		await this._validateCacheLimit({ url, currentFileName: outputFileName, alwaysCleanCache });
		const filePath = await this._downloadFile(url, outputFileName, options);
		// Validate checksum after download completes
		// Validate checksum after download completes
		try {
			if (expectedChecksum) {
				await this._validateChecksum(filePath, expectedChecksum);
			}
		} catch (error) {
			// Remove the invalid file
			await fs.remove(filePath);
			this.ui.write(`Removed invalid downloaded file: ${outputFileName}`);
			throw error;
		}

		return filePath;
	}


	async _downloadFile(url, outputFileName, options = {}) {
		const { maxRetries = 5, timeout = 10000, waitTime = 5000 } = options;
		const progressFilePath = path.join(this.downloadDir, `${outputFileName}.progress`);
		const finalFilePath = path.join(this.downloadDir, outputFileName);
		let attempt = 0;
		while (attempt < maxRetries) {
			try {
				return await this._attemptDownload(url, outputFileName, progressFilePath, finalFilePath, timeout);
			} catch (error) {
				attempt++;
				if (attempt >= maxRetries) {
					throw new Error(`Failed to download file after ${maxRetries} attempts: ${error.message}`);
				}
				this.ui.write(`Retrying download for ${outputFileName} after waiting for ${waitTime}ms...`);
				await delay(waitTime);
			}
		}
	}

	async _validateCacheLimit({ url, currentFileName, alwaysCleanCache = false }) {
		const maxCacheSizeGB = parseFloat(settings.tachyonCacheLimitGB);
		const fileHeaders = await fetch(url, { method: 'HEAD' });

		const contentLength = parseInt(fileHeaders.headers.get('content-length') || '0', 10);
		// get the size of the download directory
		const downloadDirStats = await this.getDownloadedFilesStats(currentFileName);
		const totalSizeGB = (downloadDirStats.totalSize + contentLength) / (1024 * 1024 * 1024); // convert to GB
		const downloadedCacheSizeGB = downloadDirStats.totalSize / (1024 * 1024 * 1024); // convert to GB
		const shouldCleanCache = await this._shouldCleanCache({
			downloadedCacheSizeGB,
			alwaysCleanCache,
			maxCacheSizeGB,
			totalSizeGB,
			downloadDirStats
		});
		if (shouldCleanCache) {
			await this._freeCacheSpace(downloadDirStats);
		}
		return;
	}

	async getDownloadedFilesStats(currentFile) {
		const files = await fs.readdir(this.downloadDir);
		// use just the zip files and progress files
		const packageFiles = files.filter(file => file.endsWith('.zip') || file.endsWith('.progress'));
		// exclude the current file from the list
		const filteredFiles = currentFile ? packageFiles.filter(file => file !== currentFile && file !== `${currentFile}.progress`) : packageFiles;
		// stat to get size, and mtime to sort by date modified
		const fileStats = await Promise.all(filteredFiles.map(async (file) => {
			const filePath = path.join(this.downloadDir, file);
			const stats = await fs.stat(filePath);
			return { filePath, size: stats.size, mtime: stats.mtime };
		}));
		// sort files by date modified
		const sortedFileStats = fileStats.sort((a, b) => a.mtime - b.mtime);

		return {
			totalSize: sortedFileStats.reduce((sum, file) => sum + file.size, 0),
			fileStats
		};
	}

	async _shouldCleanCache({ downloadedCacheSizeGB, alwaysCleanCache, maxCacheSizeGB, totalSizeGB, downloadDirStats }) {
		if (maxCacheSizeGB === 0 || alwaysCleanCache) {
			return true;
		}
		if (maxCacheSizeGB === -1) {
			return false;
		}

		if (totalSizeGB < maxCacheSizeGB || downloadDirStats.fileStats.length === 0) {
			return false;
		}
		const question = {
			type: 'confirm',
			name: 'cleanCache',
			message: `Do you want to delete previously downloaded versions to free up ${downloadedCacheSizeGB.toFixed(1)} GB of space?`,
			default: true
		};
		const answer = await this.ui.prompt(question);
		if (!answer.cleanCache) {
			this.ui.write('Cache cleanup skipped. Remove files manually to free up space.');
		}
		return answer.cleanCache;
	}

	async _attemptDownload(url, outputFileName, progressFilePath, finalFilePath, timeout) {
		const progressBar = this.ui.createProgressBar();
		let downloadedBytes = 0;
		if (fs.existsSync(progressFilePath)) {
			downloadedBytes = fs.statSync(progressFilePath).size;
			this.ui.write(`Resuming download file: ${outputFileName}`);
		}
		const headers = downloadedBytes > 0 ? { Range: `bytes=${downloadedBytes}-` } : {};
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		try {
			const response = await fetch(url, { headers, signal: controller.signal });
			clearTimeout(timeoutId);
			if (!response.ok && response.status !== 206) {
				throw new Error(`Unexpected response status: ${response.status}`);
			}
			const totalBytes = parseInt(response.headers.get('content-length') || '0', 10) + downloadedBytes;
			if (progressBar && totalBytes) {
				progressBar.start(totalBytes, downloadedBytes, { description: `Downloading ${outputFileName} ...` });
			}
			await this._streamToFile(response.body, progressFilePath, progressBar, downloadedBytes, timeout, controller);
			fs.renameSync(progressFilePath, finalFilePath);
			return finalFilePath;
		} finally {
			if (progressBar) {
				progressBar.stop();
			}
		}
	}

	async _streamToFile(stream, filePath, progressBar, downloadedBytes, timeout, controller) {
		const writer = fs.createWriteStream(filePath, { flags: 'a' });
		return new Promise((resolve, reject) => {
			let streamTimeout = setTimeout(() => {
				controller.abort();
				reject(new Error('Stream timeout'));
			}, timeout);
			stream.on('data', (chunk) => {
				clearTimeout(streamTimeout);
				streamTimeout = setTimeout(() => {
					controller.abort();
					reject(new Error('Stream timeout'));
				}, timeout);
				downloadedBytes += chunk.length;
				if (progressBar) {
					progressBar.increment(chunk.length);
				}
			});
			stream.pipe(writer);
			stream.on('error', (err) => {
				clearTimeout(streamTimeout);
				reject(err);
			});
			writer.on('finish', () => {
				clearTimeout(streamTimeout);
				resolve();
			});
		});
	}


	async _getCachedFile(fileName, expectedChecksum) {
		const cachedFilePath = path.join(this.downloadDir, fileName);
		if (fs.existsSync(cachedFilePath)) {
			if (expectedChecksum) {
				try {
					await this._validateChecksum(cachedFilePath, expectedChecksum);
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

	async _validateChecksum(filePath, expectedChecksum) {
		return this.ui.showBusySpinnerUntilResolved('Performing checksum validation...', new Promise((resolve, reject) => {
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
		}));

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

	async _freeCacheSpace(downloadDirStats) {
		const { fileStats } = downloadDirStats;
		for (const file of fileStats) {
			const { filePath } = file;
			await fs.remove(filePath);
		}
	}
}

module.exports = DownloadManager;
