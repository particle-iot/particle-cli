'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const pkg = require('../../package');
const semver = require('semver');
const log = require('../lib/log');
const chalk = require('chalk');
const settings = require('../../settings');
const fetch = require('node-fetch');
const { pipeline } = require('stream/promises');
const { getProxyAgent } = require('../lib/http-proxy');
const zlib = require('zlib');
const Spinner = require('cli-spinner').Spinner;
const crypto = require('crypto');

/*
 * The update-cli command updates the latest single executable version of the CLI.
 * If the CLI is not running the single executable version, recommend using the installer.
 */
class UpdateCliCommand {
	update({ 'enable-updates': enableUpdates, 'disable-updates': disableUpdates, version }) {
		if (enableUpdates) {
			return this.enableUpdates();
		}
		if (disableUpdates) {
			return this.disableUpdates();
		}
		if (!process.pkg) {
			log.info(`Update the CLI by running ${chalk.bold('npm install -g particle-cli')}`);
			log.info('To stay up to date with the latest features and improvements, please install the latest Particle Installer executable from our website: https://www.particle.io/cli');
			return;
		}
		return this.updateCli(version);
	}

	async enableUpdates() {
		// set the update flag to true
		settings.profile_json.enableUpdates = true;
		settings.saveProfileData();
		log.info('Automatic update checks are now enabled');
	}
	async disableUpdates() {
		// set the update flag to false
		settings.profile_json.enableUpdates = false;
		settings.saveProfileData();
		log.info('Automatic update checks are now disabled');
	}

	async updateCli(version) {
		log.info(`Updating the CLI to ${version ? version : 'latest'}`);
		const spinner = new Spinner('Updating CLI...');
		spinner.start();
		// download manifest
		const manifest = await this.downloadManifest(version);
		const upToDate = semver.gte(pkg.version, manifest.version) && !version;
		if (upToDate) {
			spinner.stop(true);
			log.info('CLI is already up to date');
			return;
		}
		const cliPath = await this.downloadCLI(manifest);
		await this.replaceCLI(cliPath);
		spinner.stop(true);
		await this.configureProfileSettings(version);
		log.info('CLI updated successfully');
	}

	async downloadManifest(version) {
		const fileName = version ? `manifest-${version}.json` : 'manifest.json';
		const url = `https://${settings.manifestHost}/particle-cli/${fileName}`;
		let body;
		try {
			const response = await fetch(url, { agent: getProxyAgent(url, { proxyUrl: settings.proxyUrl }) });
			if (response.status !== 200) {
				return this.logAndReject(`Failed to download manifest: Status Code ${response.status}`, version);
			}
			body = await response.text();
		} catch (error) {
			return this.logAndReject(error, version);
		}
		try {
			return JSON.parse(body);
		} catch (error) {
			return this.logAndReject(error, version);
		}
	}

	logAndReject(error, version) {
		const baseMessage = 'We were unable to check for updates';
		const message = version ? `${baseMessage}: Version ${version} not found` : `${baseMessage} Please try again later`;
		log.error(error.message || error);
		// rejects with a string, as callers and tests expect
		return Promise.reject(message);
	}

	async downloadCLI(manifest, _os = os) {
		try {
			const { url, sha256: expectedHash } = this.getBuildDetailsFromManifest(manifest, _os);
			const fileName = url.split('/').pop();
			const fileNameWithoutLastExtension = path.basename(fileName, path.extname(fileName));
			const filePath = path.join(os.tmpdir(), fileNameWithoutLastExtension);
			const tempFilePath = `${filePath}.gz`;

			const response = await fetch(url, { agent: getProxyAgent(url, { proxyUrl: settings.proxyUrl }) });
			if (response.status !== 200) {
				log.debug(`Failed to download CLI: Status Code ${response.status}`);
				throw new Error('No file found to download');
			}
			await pipeline(response.body, fs.createWriteStream(tempFilePath));

			const fileHash = await this.getFileHash(tempFilePath);
			if (fileHash !== expectedHash) {
				throw new Error('Hash mismatch');
			}
			return await this.unzipFile(tempFilePath, filePath);
		} catch (error) {
			log.debug(`Failed during download or verification: ${error}`);
			throw new Error('Failed to download or verify the CLI, please try again later');
		}
	}

	async getFileHash(filePath) {
		return new Promise((resolve, reject) => {
			const hash = crypto.createHash('sha256');
			const stream = fs.createReadStream(filePath);
			stream.on('data', (data) => hash.update(data));
			stream.on('end', () => resolve(hash.digest('hex')));
			stream.on('error', (error) => reject(error));
		});
	}

	async unzipFile(sourcePath, targetPath) {
		return new Promise((resolve, reject) => {
			const gunzip = zlib.createGunzip();
			const source = fs.createReadStream(sourcePath);
			const destination = fs.createWriteStream(targetPath);
			source
				.pipe(gunzip)
				.pipe(destination)
				.on('finish', () => resolve(targetPath))
				.on('error', (error) => reject(error));
		});
	}

	getBuildDetailsFromManifest(manifest, _os = os) {
		const platform = _os.platform();
		const arch = _os.arch();
		const platformKey = platform;
		const archKey = arch;
		const platformManifest = manifest.builds && manifest.builds[platformKey];
		const archManifest = platformManifest && platformManifest[archKey];
		if (!archManifest) {
			throw new Error(`No CLI build found for ${platform} ${arch}`);
		}
		return archManifest;
	}

	async replaceCLI(newCliPath) {
		// rename the original CLI
		const binPath = this.getBinaryPath();
		const fileName = path.basename(process.execPath);
		const cliPath = process.execPath;
		const oldCliPath = path.join(binPath, `${fileName}.old`);
		await fs.move(cliPath, oldCliPath, { overwrite: true });
		await fs.move(newCliPath, cliPath);
		await fs.chmod(cliPath, 0o755); // add execute permissions
	}

	getBinaryPath() {
		return path.dirname(process.execPath);
	}
	async configureProfileSettings(version) {
		settings.profile_json.last_version_check = new Date().getTime();
		settings.saveProfileData();
		if (version) {
			await this.disableUpdates(); // disable updates since we are installing a specific version
		}
	}
}

module.exports = UpdateCliCommand;
