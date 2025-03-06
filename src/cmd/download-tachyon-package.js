const CLICommandBase = require('./base');
const DownloadManager = require('../lib/download-manager');

module.exports = class DownloadTachyonPackageCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
	}

	async _selectRegion() {
		const regionMapping = {
			'NA (North America)': 'NA',
			'RoW (Rest of the World)': 'RoW'
		};
		const question = [
			{
				type: 'list',
				name: 'region',
				message: 'Select the region:',
				choices: Object.keys(regionMapping),
			},
		];
		const { region } = await this.ui.prompt(question);
		return regionMapping[region];
	}

	async _selectVersion() {
		const question = [
			{
				type: 'input',
				name: 'version',
				message: 'Enter the version number:',
				default: 'latest',
			},
		];
		const answer = await this.ui.prompt(question);
		return answer.version;
	}
	async download ({ region, version, alwaysCleanCache = false, variant = 'headless', board = 'formfactor' }) {
		// prompt for region and version if not provided
		if (!region) {
			region = await this._selectRegion();
		}
		if (!version) {
			version = await this._selectVersion();
		}
		const manager = new DownloadManager(this.ui);
		const manifest = await manager.fetchManifest({ version });
		const build = manifest.builds.find((b) => b.region === region && b.variant === variant && b.board === board);
		if (!build) {
			throw new Error('No build available for the provided parameters');
		}
		const { artifact_url: url, sha256_checksum: expectedChecksum } = build.artifacts[0];
		const outputFileName = url.replace(/.*\//, '');
		const filePath = await manager.download({ url, outputFileName, expectedChecksum, options: { alwaysCleanCache } });
		this.ui.write(`Downloaded package to: ${filePath}`);

		return filePath;
	}

	async cleanUp({ region, version, variant = 'headless', board ='formfactor', all }) {
		const manager = new DownloadManager(this.ui);
		if (all) {
			await manager.cleanup({ cleanDownload: true, cleanInProgress: true });
			this.ui.write('Cleaned up all cached packages');
		} else {
			if (!region) {
				region = await this._selectRegion();
			}
			if (!version) {
				version = await this._selectVersion();
			}
			const manifest = await manager.fetchManifest({ version });
			const build = manifest.builds.find((b) => b.region === region && b.variant === variant && b.board === board);
			if (!build) {
				throw new Error('No build available for the provided parameters');
			}
			const { artifact_url: url } = build.artifacts[0];
			const outputFileName = url.replace(/.*\//, '');
			await manager.cleanup({ cleanDownload: false, fileName: outputFileName });
			this.ui.write(`Cleaned up package cache for region: ${region} and version: ${version}`);
		}
	}
};
