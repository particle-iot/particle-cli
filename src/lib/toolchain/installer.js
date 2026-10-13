'use strict';
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const temp = require('temp').track();
const fetch = require('node-fetch');
const { unpackTarGz } = require('@particle/unpack-file');
const settings = require('../../../settings');
const UI = require('../ui');
const { displayName } = require('./manifest');

const RECEIPT_FILE = '.particle-install-receipt';
const DOWNLOAD_TIMEOUT_MS = 30000;
const DOWNLOAD_ATTEMPTS = 2;

/**
 * Installs toolchain dependencies under `~/.particle/toolchains/<name>/<version>`,
 * the layout Workbench uses, and never downloads one that is already there.
 * "Installed" means the receipt file exists; a partial unpack has none.
 */
class ToolchainInstaller {
	/**
	 * @param {object} [opts]
	 * @param {UI} [opts.ui]
	 * @param {string} [opts.toolchainDir] defaults to `~/.particle/toolchains`
	 */
	constructor({ ui = new UI(), toolchainDir } = {}) {
		this.ui = ui;
		this.toolchainDir = toolchainDir || path.join(settings.ensureFolder(), 'toolchains');
	}

	/** @returns {string} `<toolchainDir>/<name>/<version>` */
	rootFor(dependency) {
		return path.join(this.toolchainDir, dependency.name, dependency.version);
	}

	/** @returns {string} the directory the dependency's `main` points at */
	dirFor(dependency) {
		return path.join(this.rootFor(dependency), dependency.main || '.');
	}

	receiptFor(dependency) {
		return path.join(this.rootFor(dependency), RECEIPT_FILE);
	}

	/** @returns {Promise<boolean>} */
	async isInstalled(dependency) {
		try {
			const receipt = await fs.readJson(this.receiptFor(dependency));
			return receipt.name === dependency.name && receipt.version === dependency.version;
		} catch (_error) {
			return false;
		}
	}

	/**
	 * Downloads, verifies and unpacks every dependency that is not installed yet.
	 * Prints nothing when everything is already there.
	 * @param {object[]} dependencies manifest entries `{ name, version, main, url, sha256 }`
	 * @param {object} [opts]
	 * @param {string} [opts.label] what the toolchain is for, used in the header line
	 * @returns {Promise<{ installed: object[], skipped: object[] }>}
	 */
	async ensureInstalled(dependencies, { label } = {}) {
		const installed = [];
		const skipped = [];
		for (const dependency of dependencies) {
			(await this.isInstalled(dependency) ? skipped : installed).push(dependency);
		}
		if (installed.length === 0) {
			return { installed, skipped };
		}

		const sizes = await Promise.all(installed.map(d => this._contentLength(d.url)));
		const list = installed.map((d, i) => `${displayName(d)}${sizes[i] ? ` (${formatSize(sizes[i])})` : ''}`).join(', ');
		this._write(`${label ? `${label}: ` : ''}downloading ${list} to ${this.toolchainDir}`);

		for (const dependency of installed) {
			await this.install(dependency);
		}
		return { installed, skipped };
	}

	/**
	 * Installs one dependency. Any failure leaves no receipt and no partial files
	 * behind, so the next run downloads it again.
	 * @param {object} dependency
	 */
	async install(dependency) {
		const root = this.rootFor(dependency);
		const tmpFile = temp.path({ suffix: '.tar.gz' });
		try {
			await this._downloadAndVerify(dependency, tmpFile);
			await fs.remove(root);
			await fs.ensureDir(root);
			await this.ui.showBusySpinnerUntilResolved(`Extracting ${displayName(dependency)} ...`,
				unpackTarGz(tmpFile, root));
			await fs.writeJson(this.receiptFor(dependency), {
				name: dependency.name,
				version: dependency.version,
				installed: Date.now()
			}, { spaces: 4 });
			this._write(`Installed ${displayName(dependency)}`);
		} catch (error) {
			await fs.remove(root).catch(() => {});
			throw new Error(`Could not download ${displayName(dependency)} for the local toolchain: ${error.message}. Check your connection and retry`);
		} finally {
			await fs.remove(tmpFile).catch(() => {});
		}
	}

	async _downloadAndVerify(dependency, tmpFile) {
		let lastError;
		for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
			try {
				await this._download(dependency, tmpFile);
				await this.ui.showBusySpinnerUntilResolved(`Verifying ${displayName(dependency)} ...`,
					this._verify(tmpFile, dependency.sha256));
				return;
			} catch (error) {
				lastError = error;
				await fs.remove(tmpFile).catch(() => {});
				if (attempt < DOWNLOAD_ATTEMPTS) {
					this._write(`Retrying download of ${displayName(dependency)}: ${error.message}`);
				}
			}
		}
		throw lastError;
	}

	async _download(dependency, tmpFile) {
		const progressBar = this.ui.quiet ? null : this.ui.createProgressBar();
		const controller = new AbortController();
		let watchdog = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
		const resetWatchdog = () => {
			clearTimeout(watchdog);
			watchdog = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
		};
		try {
			const response = await fetch(dependency.url, { signal: controller.signal });
			if (!response.ok) {
				throw new Error(`HTTP ${response.status} from ${dependency.url}`);
			}
			const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
			if (progressBar && totalBytes) {
				progressBar.start(totalBytes, 0, { description: `Downloading ${displayName(dependency)} ...` });
			}
			await new Promise((resolve, reject) => {
				const writer = fs.createWriteStream(tmpFile);
				response.body.on('data', (chunk) => {
					resetWatchdog();
					if (progressBar && totalBytes) {
						progressBar.increment(chunk.length);
					}
				});
				response.body.on('error', reject);
				writer.on('error', reject);
				writer.on('finish', resolve);
				response.body.pipe(writer);
			});
		} catch (error) {
			if (error.name === 'AbortError') {
				throw new Error(`timed out after ${DOWNLOAD_TIMEOUT_MS / 1000}s without data`);
			}
			throw error;
		} finally {
			clearTimeout(watchdog);
			if (progressBar) {
				progressBar.stop();
			}
		}
	}

	async _verify(filePath, expected) {
		const actual = await new Promise((resolve, reject) => {
			const hash = crypto.createHash('sha256');
			fs.createReadStream(filePath)
				.on('data', chunk => hash.update(chunk))
				.on('end', () => resolve(hash.digest('hex')))
				.on('error', reject);
		});
		if (actual !== expected) {
			throw new Error(`checksum mismatch, expected ${expected} got ${actual}`);
		}
	}

	async _contentLength(url) {
		try {
			const response = await fetch(url, { method: 'HEAD' });
			return parseInt(response.headers.get('content-length') || '0', 10);
		} catch (_error) {
			return 0;
		}
	}

	_write(message) {
		if (!this.ui.quiet) {
			this.ui.write(message);
		}
	}
}

function formatSize(bytes) {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
	}
	if (bytes >= 1024 * 1024) {
		return `${Math.round(bytes / (1024 * 1024))} MB`;
	}
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

module.exports = {
	ToolchainInstaller,
	RECEIPT_FILE,
	formatSize
};
