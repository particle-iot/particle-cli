const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');
const settings = require('../../settings');
const fs = require('fs-extra');
const path = require('path');
const { getEDLDevice, getTachyonInfo, prepareFlashFiles } = require('../lib/tachyon-utils');
const os = require('os');
const QdlFlasher = require('../lib/qdl');
const DownloadManager = require('../lib/download-manager');
const FlashCommand = require('./flash');

const PARTITIONS_TO_BACKUP = ['nvdata1', 'nvdata2', 'fsc', 'fsg', 'modemst1', 'modemst2'];

module.exports = class TachyonFactoryReset extends CLICommandBase {
	constructor(args) {
		const { ui, 'reset-dir': resetDir } = args;
		super();
		this.ui = ui || this.ui;
		spinnerMixin(this);
		this._baseDir = settings.ensureFolder();
		this._resetDir = path.join(resetDir || process.cwd());
		this._logsDir = path.join(this._baseDir, 'logs');
		this.outputLog = null;
		this.device = null;
		this.deviceInfo = {
			board: 'formfactor'
		};
	}

	async factoryReset({ board } = {}){
		// prepare directories:
		this.ui.write('Preparing your device for a factory reset...');
		await fs.ensureDir(this._resetDir);
		await fs.ensureDir(this._logsDir);
		this.ui.write('Connecting with your device, make sure your device is in system update mode (blinking yellow)');
		this.device = await getEDLDevice({ ui: this.ui });
		this.outputLog = path.join(this._logsDir, `tachyon_${this.device.id}_factory_restore_${Date.now()}`);
		this.ui.write(`Logs will be saved in ${this.outputLog}`);
		// getting device info or ask
		await this._getTachyonInfo({ board });

		if (this.deviceInfo.manufacturingData === 'Missing') {
			this._printMissingFilesWarning();
		}
		// backup nv data
		await this.ui.showBusySpinnerUntilResolved('Backing up device NV data', this._backup());
		// download os
		const downloadPath = await this._downloadFactoryOS();
		// flash os
		await this._flashFactoryOS({ osPath: downloadPath });
		// restore nv data
		await this.ui.showBusySpinnerUntilResolved('Restoring device NV data', this._restore());
	}

	async _getTachyonInfo({ board } = {}) {
		let tachyonInfo;
		try {
			tachyonInfo = await this.ui.showBusySpinnerUntilResolved('Getting device information...',
				getTachyonInfo({
					outputLog: this.outputLog,
					ui: this.ui,
					device: this.device
				}));
		} catch (error) {
			// if something fails, we're going to ask so omit this issue (the device is bricked so can fail)
			this.ui.write(this.ui.chalk.yellow(`Couldn't get device info ${os.EOL}`));
		}

		this.deviceInfo.manufacturingData - tachyonInfo?.manufacturingData || 'Missing';
		this.deviceInfo.board = board || 'formfactor';
		if (!tachyonInfo?.region || tachyonInfo?.region === 'Unknown') {
			this.deviceInfo.region = await this._selectRegion();
		} else {
			this.deviceInfo.region = tachyonInfo.region;
		}
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

	async _printMissingFilesWarning() {
		const title = this.ui.chalk.yellow(`Missing manufacturing files detected ${os.EOL}`);
		const content = `Looks like some required files aren’t on this device.${os.EOL}` +
			`You can continue the factory reset, but you’ll need to run:${os.EOL}`;
		const command = this.ui.chalk.cyan(`    particle tachyon restore --input-dir /path/to/files ${os.EOL}`);
		const bottom = `afterward to restore them. Contact support if you don’t have the missing files.${os.EOL}`;
		this.ui.write(title + content + command + bottom);
	}

	async _backup(){
		try {
			// verify if backups files already exists:
			const hasBackups = await this.hasBackups();
			if (hasBackups) {
				this.ui.write('Backups found in the working directory');
			} else {
				const { firehosePath, xmlFile } = await prepareFlashFiles({
					logFile: this.outputLog,
					ui: this.ui,
					partitionsList: PARTITIONS_TO_BACKUP,
					dir: this._resetDir,
					device: this.device,
					operation: 'read'
				});
				const files = [
					firehosePath, // must be first
					xmlFile,
				];

				const qdl = new QdlFlasher({
					outputLogFile: this.outputLog,
					files: files,
					ui: this.ui,
					currTask: 'Backup',
					skipReset: true,
					serialNumber: this.device.serialNumber
				});
				await qdl.run();
				this.ui.stdout.write(`Backup up NV data from device ${this.device.id} complete!${os.EOL}`);
			}
		} catch (error) {
			this.ui.stdout.write(`An error ocurred while trying to backing up your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${this.outputLog} for more information ${os.EOL}`);
		}
	}

	async hasBackups() {
		const names = await fs.readdir(this._resetDir);
		const prefix = `${this.device.id}_`;
		return names.some(name => name.startsWith(prefix) && name.endsWith('.backup'));
	}

	async _downloadFactoryOS(){
		const manager = new DownloadManager(this.ui);
		const manifest = await manager.fetchManifest({ version: 'factory', isRb3Board: false });
		const { region, board } = this.deviceInfo;
		const build = manifest?.builds.find(build => build.region === region && build.variant === 'factory' && build.board === board);

		if (!build) {
			throw new Error('No build available for the provided parameters');
		}

		const artifact = build.artifacts[0];
		const url = artifact.artifact_url;
		const outputFileName = url.replace(/.*\//, '');
		const expectedChecksum = artifact.sha256_checksum;
		return manager.download({ url, outputFileName, expectedChecksum });
	}
	async _flashFactoryOS({ osPath }) {
		try {
			const flashCommand = new FlashCommand();
			await flashCommand.flashTachyon({
				device: this.device,
				files: [osPath],
				skipReset: true,
				output: this.outputLog,
				verbose: false
			});
		} catch (error) {
			this.ui.stdout.write(`An error ocurred while trying to restore up your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${this.outputLog} for more information ${os.EOL}`);
		}
	}
	async _restore() {
		try {
			const { firehosePath, xmlFile } = await prepareFlashFiles({
				logFile: this.outputLog,
				ui: this.ui,
				partitionsList: PARTITIONS_TO_BACKUP,
				dir: this._resetDir,
				device: this.device,
				operation: 'program',
				checkFiles: true
			});
			const files = [
				firehosePath, // must be first
				xmlFile,
			];

			const qdl = new QdlFlasher({
				outputLogFile: this.outputLog,
				files: files,
				ui: this.ui,
				currTask: 'Restore',
				skipReset: true,
				serialNumber: this.device.serialNumber,
			});
			await qdl.run();
		} catch (error) {
			this.ui.stdout.write(`An error ocurred while trying to restore up your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${this.outputLog} for more information ${os.EOL}`);
		}
	}
};
