const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const pkg = require('../../package');
const semver = require('semver');
const log = require('../lib/log');
const chalk = require('chalk');
const settings = require('../../settings');
const request = require('request');
const zlib = require('zlib');
const Spinner = require('cli-spinner').Spinner;
const crypto = require('crypto');

/*
 * The update-cli command tells the CLI installer to reinstall the latest version of the CLI
 * See https://github.com/particle-iot/particle-cli-wrapper/blob/master/shell.go#L12
 *
 * If the CLI was installed using npm, tell the user to update using npm
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
		console.log('here is doing');
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
		return new Promise((resolve, reject ) => {
			return request(url, (error, response, body) => {
				if (error) {
					return this.logAndReject(error, reject, version);
				}
				if (response.statusCode !== 200) {
					return this.logAndReject(`Failed to download manifest: Status Code ${response.statusCode}`, reject, version);
				}
				try {
					resolve(JSON.parse(body));
				} catch (error) {
					this.logAndReject(error, reject, version);
				}
			});
		});
	}

	logAndReject(error, reject, version) {
		const baseMessage = 'We were unable to check for updates';
		const message = version ? `${baseMessage}: Version ${version} not found` : `${baseMessage} Please try again later`;
		log.error(error);
		reject(message);
	}

	async downloadCLI(manifest) {
		try {
			const { url, sha256: expectedHash } = this.getBuildDetailsFromManifest(manifest);
			const fileName = url.split('/').pop();
			const fileNameWithoutLastExtension = path.basename(fileName, path.extname(fileName));
			const filePath = path.join(os.tmpdir(), fileNameWithoutLastExtension);
			const tempFilePath = `${filePath}.gz`;

			const output = fs.createWriteStream(tempFilePath);

			return await new Promise((resolve, reject) => {
				request(url)
					.on('response', (response) => {
						if (response.statusCode !== 200) {
							log.debug(`Failed to download CLI: Status Code ${response.statusCode}`);
							return reject(new Error('No file found to download'));
						}
					})
					.pipe(output)
					.on('finish', async () => {
						const fileHash = await this.getFileHash(tempFilePath);
						if (fileHash === expectedHash) {
							const unzipPath = await this.unzipFile(tempFilePath, filePath);
							resolve(unzipPath);
						} else {
							reject(new Error('Hash mismatch'));
						}
					})
					.on('error', (error) => {
						reject(error);
					});
			});
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

	getBuildDetailsFromManifest(manifest) {
		const platformMapping = {
			darwin: 'darwin',
			linux: 'linux',
			win32: 'win'
		};
		const archMapping = {
			x64: 'amd64',
			arm64: 'arm64'
		};
		const platform = os.platform();
		const arch = os.arch();
		const platformKey = platformMapping[platform] || platform;
		const archKey = archMapping[arch] || arch;
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
		const fileName = path.basename(process.execPath, path.extname(process.execPath));
		const cliPath = path.join(binPath, fileName);
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
