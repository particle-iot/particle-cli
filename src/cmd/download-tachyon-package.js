'use strict';
const CLICommandBase = require('./base');
const DownloadManager = require('../lib/download-manager');
const { workflows, getWorkflowForDistro } = require('../lib/tachyon/workflow');
const { promptOSSelection, hasStableRelease } = require('../lib/tachyon-utils');

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

	async _selectVersion(defaultVersion = 'stable') {
		const question = [
			{
				type: 'input',
				name: 'version',
				message: 'Enter the version number:',
				default: defaultVersion,
			},
		];
		const answer = await this.ui.prompt(question);
		return answer.version;
	}

	async _selectVariant(variants) {
		if (variants.length === 1) {
			return variants[0].value;
		}
		const { variant } = await this.ui.prompt([{
			type: 'list', name: 'variant', message: 'Select the OS variant:', choices: variants
		}]);
		return variant;
	}

	async download ({ region, version, alwaysCleanCache = false, variant, board = 'formfactor_dvt', distro_version: distroVersion }) {
		const isRb3Board = board === 'rb3g2';
		const manager = new DownloadManager(this.ui);
		let workflow;
		let stableManifest;
		if (!isRb3Board) {
			if (!distroVersion || !version) {
				stableManifest = await manager.fetchManifest({ version: 'stable' });
			}
			workflow = distroVersion ? getWorkflowForDistro(distroVersion) :
				await promptOSSelection({ ui: this.ui, workflows, stableBuilds: stableManifest.builds });
		}
		if (!region) {
			region = !isRb3Board ? await this._selectRegion() : '';
		}
		if (!version) {
			const defaultVersion = workflow && !hasStableRelease(workflow, stableManifest.builds) ? 'latest' : 'stable';
			version = await this._selectVersion(defaultVersion);
		}
		const variants = workflow ? workflow.variants : [{ name: 'preinstalled server', value: 'preinstalled-server' }];
		if (!variant) {
			variant = await this._selectVariant(variants);
		}
		const manifest = version === 'stable' && stableManifest ? stableManifest : await manager.fetchManifest({ version });
		const build = manifest?.builds.find(build => build.region === region && build.variant === variant && build.board === board &&
			(workflow ? build.distribution === workflow.osInfo.distribution && build.distribution_version === workflow.osInfo.distributionVersion :
				(!distroVersion || build.distribution_version === distroVersion)));

		if (!build) {
			throw new Error('No build available for the provided parameters');
		}
		const { artifact_url: url, sha256_checksum: expectedChecksum } = build.artifacts[0];
		const outputFileName = url.replace(/.*\//, '');
		const filePath = await manager.download({ url, outputFileName, expectedChecksum, options: { alwaysCleanCache } });
		this.ui.write(`Downloaded package to: ${filePath}`);

		return filePath;
	}

	async cleanUp({ region, version, variant = 'headless', board = 'formfactor_dvt', all }) {
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
