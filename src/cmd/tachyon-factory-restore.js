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

const RESTORE_DOCS_URL = 'https://developer.particle.io/tachyon/troubleshooting-and-tricks/restore';

module.exports = class TachyonFactoryRestore extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
		spinnerMixin(this);
		this._baseDir = settings.ensureFolder();
		this._backupDir = path.join(process.cwd());
		this._logsDir = path.join(this._baseDir, 'logs');
		this.outputLog = null;
		this.device = null;
		this.deviceInfo = {
			board: 'formfactor_dvt'
		};
	}

	async restore(){
		let continueProcess = await this.confirmProcess();
		if (!continueProcess) {
			return;
		}
		// prepare directories:
		this.ui.write('Preparing your device for factory restore...');
		await fs.ensureDir(this._backupDir);
		await fs.ensureDir(this._logsDir);
		this.ui.write('Connecting with your device, make sure your device is in system update mode (blinking yellow).');
		this.device = await getEDLDevice({ ui: this.ui });
		this.outputLog = path.join(this._logsDir, `tachyon_${this.device.id}_factory_restore_${Date.now()}.log`);
		this.ui.write(`Logs will be saved in ${this.outputLog}`);
		// getting device info or ask
		await this._getTachyonInfo();

		const hasBackups = await this.hasBackups();
		if (hasBackups) {
			this.ui.write('Backup of manufacturing data found in the working directory, skipping backup step.');
		} else {
			continueProcess = await this._printMissingFilesWarning();
			if (!continueProcess) {
				return;
			}
		}
		// download os
		this.ui.write('Downloading factory image...');
		const downloadPath = await this._downloadFactoryOS();
		// flash os
		this.ui.write('Installing factory image...');
		await this._flashFactoryOS({ osPath: downloadPath });
		// restore nv data (it will check all backups stuff)
		await this.restoreNVDataStep();
		await this.setupStep();
	}

	async confirmProcess() {
		const title = this.ui.chalk.bold(` WARNING ${os.EOL}`);
		const border = this.ui.chalk.yellow('─'.repeat(120));
		this.ui.write(
			`${border}${os.EOL}` +
			`${title}${os.EOL}` +
			`This process ${this.ui.chalk.bold('will erase')} the operating system, user data, and configuration from your device.${os.EOL}` +
			`If you do not have a backup of your modem provisioning data, your device ${this.ui.chalk.bold('will not function correctly')} ${os.EOL}` +
			`until Particle provides a file for your individual device to restore it for you.${os.EOL}` +
			`${os.EOL}` +
			`For more information please visit: ${RESTORE_DOCS_URL}${os.EOL}` +
			`${border}${os.EOL}`
		);
		const { continueProcess } = await this.ui.prompt({
			type: 'confirm',
			name: 'continueProcess',
			message: 'Do you want to continue with the process?',
			default: true
		});
		return continueProcess;
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
			this._printTachyonInfo(tachyonInfo);

		} catch (error) {
			// if something fails, we're going to ask so omit this issue (the device is bricked so can fail)
			this.ui.write(this.ui.chalk.yellow(`Couldn't get device info ${os.EOL}`));
		}

		this.deviceInfo.manufacturingData = tachyonInfo?.manufacturingData || 'Missing';
		if (!tachyonInfo?.region || tachyonInfo?.region === 'Unknown') {
			this.deviceInfo.region = await this._selectRegion();
		} else {
			this.deviceInfo.region = tachyonInfo.region;
		}
	}

	_printTachyonInfo(tachyonInfo) {
		const border = this.ui.chalk.cyan('─'.repeat(70));
		this.ui.write(
			`${border}${os.EOL}` +
			this.ui.chalk.bold(`Device Info: ${os.EOL}`) +
			`Device ID: ${tachyonInfo.deviceId}${os.EOL}` +
			`Region: ${tachyonInfo.region}${os.EOL}` +
			`Manufacturing data: ${tachyonInfo.manufacturingData}${os.EOL}` +
			`OS Version: ${tachyonInfo.osVersion}${os.EOL}` +
			`${border}${os.EOL}`
		);
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
		const title = this.ui.chalk.yellow.bold(
			`No local manufacturing data backup file was found.${os.EOL}`
		);
		const content =
			`The required manufacturing backup will be ${this.ui.chalk.bold(
				'obtained automatically from the cloud'
			)} during this process.${os.EOL}${os.EOL}` +
			`If you prefer to use your own backup instead, please run:${os.EOL}` +
			`  ${this.ui.chalk.cyan('particle tachyon backup')}${os.EOL}` +
			`before continuing with the restore.${os.EOL}`;

		const bottom =
			`For more details and instructions, see:${os.EOL}  ${RESTORE_DOCS_URL}${os.EOL}`;
		this.ui.write(title + content + bottom);

		const { continueProcess } = await this.ui.prompt({
			type: 'confirm',
			name: 'continueProcess',
			message: 'Do you want to continue with the process?',
			default: true
		});
		return continueProcess;
	}

	async hasBackups() {
		const names = await fs.readdir(this._backupDir);
		const expected = `manufacturing_backup_${this.device.id}.zip`;
		return names.includes(expected);
	}

	async backupStep(){
		await this.ui.showBusySpinnerUntilResolved('Backing Tachyon NV data', async () => {
			const backupCommand = new BackupRestoreCommand({ ui: this.ui });
			await backupCommand.backup({ existingLog: this.outputLog });
		});
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
		await this.ui.showBusySpinnerUntilResolved('Restore Tachyon NV data', async () => {
			const restoreCommand = new BackupRestoreCommand({ ui: this.ui });
			await restoreCommand.restore({ existingLog: this.outputLog });
		});
	}

	async setupStep() {
		this.ui.write('Starting device setup process...');
		const setupCommand = new SetupCommand({ ui: this.ui });
		await setupCommand.setup({ region: this.deviceInfo.region });
	}
};
