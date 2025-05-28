const CLICommandBase = require('./base');
const QdlFlasher = require('../lib/qdl');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {
	addLogHeaders,
	getEDLDevice,
	addLogFooter,
	prepareFlashFiles
} = require('../lib/tachyon-utils');
const settings = require('../../settings');

const PARTITIONS_TO_BACKUP = ['nvdata1', 'nvdata2', 'fsc', 'fsg', 'modemst1', 'modemst2'];

module.exports = class BackupRestoreTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
		this._baseDir = settings.ensureFolder();
		this._logsDir = path.join(this._baseDir, 'logs');
	}

	async backup({ 'output-dir': outputDir = process.cwd(), 'log-dir': logDir = this._logsDir } = {}) {
		const { id: deviceId } = await getEDLDevice({ ui: this.ui });
		const outputDirExist = await fs.exists(outputDir);
		const logDirExist = await fs.exists(logDir);
		if (!outputDirExist) {
			await fs.ensureDir(outputDir);
		}
		if (logDirExist) {
			await fs.ensureDir(logDir);
		}

		const startTime = new Date();
		const outputLog = path.join(logDir, `tachyon_${deviceId}_backup_${Date.now()}.log`);

		this.ui.stdout.write(`Backing up NV data from device ${deviceId}...${os.EOL}`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		addLogHeaders({ outputLog, startTime, deviceId, commandName: 'Tachyon backup' });
		try {
			const { firehosePath, xmlFile } = await prepareFlashFiles({
				logFile: outputLog,
				ui: this.ui,
				partitionsList: PARTITIONS_TO_BACKUP,
				dir: outputDir,
				deviceId,
				operation: 'read'
			});
			const files = [
				firehosePath, // must be first
				xmlFile,
			];

			const qdl = new QdlFlasher({
				outputLogFile: outputLog,
				files: files,
				ui: this.ui,
				currTask: 'Backup',
				skipReset: true,
			});
			await qdl.run();
			this.ui.stdout.write(`Backing up NV data from device ${deviceId} complete!${os.EOL}`);
		} catch (error) {
			this.ui.stdout.write(`An error ocurred while trying to backing up your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information ${os.EOL}`);
		} finally {
			addLogFooter({ outputLog, startTime, endTime: new Date() });
		}
	}

	async restore({
		'input-dir': inputDir = process.cwd(),
		'log-dir': logDir = this._logsDir,
	} = {})	{
		const { id: deviceId } = await getEDLDevice({ ui: this.ui });
		if (!await fs.exists(logDir)) {
			await fs.mkdir(logDir, { recursive: true });
		}

		const startTime = new Date();
		const outputLog = path.join(logDir, `tachyon_${deviceId}_restore_${Date.now()}.log`);
		this.ui.stdout.write(`Restoring NV data to device ${deviceId}...${os.EOL}`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		addLogHeaders({ outputLog, startTime, deviceId, commandName: 'Tachyon restore' });
		try {
			const { firehosePath, xmlFile } = await prepareFlashFiles({
				logFile: outputLog,
				ui: this.ui,
				partitionsList: PARTITIONS_TO_BACKUP,
				inputDir,
				deviceId,
				operation: 'program',
				checkFiles: true
			});
			const files = [
				firehosePath, // must be first
				xmlFile,
			];

			const qdl = new QdlFlasher({
				outputLogFile: outputLog,
				files: files,
				ui: this.ui,
				currTask: 'Restore',
				skipReset: true,
			});
			await qdl.run();
			this.ui.stdout.write(`Restoring NV data to device ${deviceId} complete!${os.EOL}`);

		} catch (error) {
			this.ui.stdout.write(`An error ocurred while trying to restore up your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information ${os.EOL}`);
		} finally {
			addLogFooter({ outputLog, startTime, endTime: new Date() });
		}
	}

};
