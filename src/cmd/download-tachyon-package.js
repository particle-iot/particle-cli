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
				default: 'stable',
			},
		];
		const answer = await this.ui.prompt(question);
		return answer.version;
	}

	async _selectVariant(isRb3Board) {
		const rgbVariantMapping = {
			'preinstalled server': 'preinstalled-server'
		};
		const tachyonVariantMapping = {
			'desktop (GUI)': 'desktop',
			'headless (command-line only)': 'headless'
		};
		const variantMapping = isRb3Board ? rgbVariantMapping : tachyonVariantMapping;
		const question = [
			{
				type: 'list',
				name: 'variant',
				message: 'Select the OS variant:',
				choices: Object.keys(variantMapping),
			},
		];
		const { variant } = await this.ui.prompt(question);
		return variantMapping[variant];
	}

	async download ({ region, version, alwaysCleanCache = false, variant, board = 'formfactor_dvt' }) {
		// prompt for region and version if not provided
		const isRb3Board = board === 'rb3g2'; // RGB board
		if (!region) {
			region = !isRb3Board ? await this._selectRegion() : '';
		}
		if (!version) {
			version = await this._selectVersion();
		}

		if (!variant) {
			variant = await this._selectVariant(isRb3Board);
		}
		const manager = new DownloadManager(this.ui);
		const manifest = await manager.fetchManifest({ version, isRb3Board });
		const build = manifest?.builds.find(build => build.region === region && build.variant === variant && build.board === board);

		if (!build) {
			throw new Error('No build available for the provided parameters');
		}
		const { artifact_url: url, sha256_checksum: expectedChecksum } = build.artifacts[0];
		const outputFileName = url.replace(/.*\//, '');
		const filePath = await manager.download({ url, outputFileName, expectedChecksum, options: { alwaysCleanCache } });
		this.ui.write(`Downloaded package to: ${filePath}`);

		return filePath;
	}

	async cleanUp({ region, version, variant = 'headless', board ='formfactor_dvt', all }) {
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
