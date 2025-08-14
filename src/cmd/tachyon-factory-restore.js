const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');
const settings = require('../../settings');
const fs = require('fs-extra');
const path = require('path');
const { getEDLDevice, getTachyonInfo } = require('../lib/tachyon-utils');
const os = require('os');
const DownloadManager = require('../lib/download-manager');
const FlashCommand = require('./flash');
const SetupCommand = require('./setup-tachyon');
const BackupRestoreCommand = require('./backup-restore-tachyon');


module.exports = class TachyonFactoryRestore extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
		spinnerMixin(this);
		this._baseDir = settings.ensureFolder();
		this._resetDir = path.join(process.cwd());
		this._logsDir = path.join(this._baseDir, 'logs');
		this.outputLog = null;
		this.device = null;
		this.deviceInfo = {
			board: 'formfactor' // should be formfactor_dvt but the manifest is returning formfactor
		};
	}

	async restore({ board } = {}){
		// prepare directories:
		this.ui.write('Preparing your device for a restore...');
		await fs.ensureDir(this._resetDir);
		await fs.ensureDir(this._logsDir);
		this.ui.write('Connecting with your device, make sure your device is in system update mode (blinking yellow)');
		this.device = await getEDLDevice({ ui: this.ui });
		this.outputLog = path.join(this._logsDir, `tachyon_${this.device.id}_restore_${Date.now()}`);
		this.ui.write(`Logs will be saved in ${this.outputLog}`);
		// getting device info or ask
		await this._getTachyonInfo({ board });

		if (this.deviceInfo.manufacturingData === 'Missing') {
			this._printMissingFilesWarning();
		} else {
			// backup nv data
			await this.backupStep();
		}
		// download os
		this.ui.write('Downloading restore image...');
		const downloadPath = await this._downloadFactoryOS();
		// flash os
		this.ui.write('Installing restore image...');
		await this._flashFactoryOS({ osPath: downloadPath });
		const hasBackups = await this.hasBackups();
		if (!hasBackups) {
			const noDataTitle = this.ui.chak.yellow(`No NV data backup found — device personalization was not restored.${os.EOL}`);
			const content = `If you obtain the missing files later, run:${os.EOL}`;
			const command = this.ui.chalk.cyan(`    particle tachyon restore --input-dir /path/to/files ${os.EOL}`);
			this.ui.write(noDataTitle + content + command);
		} else {
			// restore nv data
			await this.restoreNVDataStep();
			await this.setupStep();
		}
	}

	async _getTachyonInfo() {
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
			`You can continue the restoration, but you’ll need to run:${os.EOL}`;
		const command = this.ui.chalk.cyan(`    particle tachyon restore --input-dir /path/to/files ${os.EOL}`);
		const bottom = `afterward to restore them. Contact support if you don’t have the missing files.${os.EOL}`;
		this.ui.write(title + content + command + bottom);
	}

	async backupStep(){
		// verify if backups files already exists:
		const hasBackups = await this.hasBackups();
		if (hasBackups) {
			this.ui.write('Backups found in the working directory');
		} else {
			await this.ui.showBusySpinnerUntilResolved('Backing up device NV data...', this._backup());
		}
		this.nvDataBackupsExist = true;
	}
	async hasBackups() {
		const names = await fs.readdir(this._resetDir);
		const prefix = `${this.device.id}_`;
		return names.some(name => name.startsWith(prefix) && name.endsWith('.backup'));
	}

	async _backup(){
		const backupRestoreCmd = new BackupRestoreCommand({ ui: this.ui });
		await backupRestoreCmd.backup({ existingLog: this.outputLog });
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
			this.ui.stdout.write(`An error occurred while trying to restore up your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${this.outputLog} for more information ${os.EOL}`);
			throw error;
		}
	}

	async restoreNVDataStep() {
		await this.ui.showBusySpinnerUntilResolved('Restore Tachyon NV data', this._restoreNVData());
	}
	async _restoreNVData() {
		const restoreCommand = new BackupRestoreCommand({ ui: this.ui });
		await restoreCommand.restore({ existingLog: this.outputLog });
	}

	async setupStep() {
		this.ui.write('Starting device setup process...');
		const setupCommand = new SetupCommand({ ui: this.ui });
		await setupCommand.setup();
	}
};
