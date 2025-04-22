const CLICommandBase = require('./base');
const QdlFlasher = require('../lib/qdl');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const {
	addLogHeaders,
	getEDLDevice,
	addLogFooter,
	generateXml,
	initFiles,
	readPartitionsFromDevice,
	partitionDefinitions
} = require('../lib/tachyon-utils');

const PARTITIONS_TO_BACKUP = ['nvdata1', 'nvdata2', 'fsc', 'fsg', 'modemst1', 'modemst2'];

module.exports = class BackupRestoreTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
	}

	async backup({ 'output-dir': outputDir = process.cwd(), 'log-dir': logDir = process.cwd() } = {}) {
		const { id: deviceId } = await getEDLDevice({ ui: this.ui });
		const outputDirExist = await fs.exists(outputDir);
		const logDirExist = await fs.exists(logDir);
		if (!outputDirExist) {
			await fs.ensureDir(outputDir);
		}
		if (logDirExist) {
			await fs.ensureDir(logDir);
		}
		const { firehosePath, tempPath, gptXmlPath } = await initFiles();

		const startTime = new Date();
		const outputLog = path.join(logDir, `tachyon_${deviceId}_backup_${Date.now()}.log`);

		this.ui.stdout.write(`Backing up NV data from device ${deviceId}...${os.EOL}`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		addLogHeaders({ outputLog, startTime, deviceId, commandName: 'Tachyon backup' });
		const partitionTable = await readPartitionsFromDevice({
			logFile: outputLog,
			ui: this.ui,
			tempPath,
			firehosePath,
			gptXmlPath
		});
		const partitions = partitionDefinitions({
			partitionList: PARTITIONS_TO_BACKUP,
			partitionTable,
			deviceId,
			dir: outputDir
		});

		const xmlFile = await generateXml({ partitions, tempPath, operation: 'read' });

		const files = [
			firehosePath,
			xmlFile
		];
		try {
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
		'log-dir': logDir = process.cwd(),
	} = {})	{
		const { id: deviceId } = await getEDLDevice({ ui: this.ui });
		if (!await fs.exists(logDir)) {
			await fs.mkdir(logDir, { recursive: true });
		}
		const { firehosePath, tempPath, gptXmlPath }  = await initFiles();

		const startTime = new Date();
		const outputLog = path.join(logDir, `tachyon_${deviceId}_restore_${Date.now()}.log`);
		this.ui.stdout.write(`Restoring NV data to device ${deviceId}...${os.EOL}`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		addLogHeaders({ outputLog, startTime, deviceId, commandName: 'Tachyon restore' });
		const partitionTable = await readPartitionsFromDevice({
			logFile: outputLog,
			ui: this.ui,
			tempPath,
			firehosePath,
			gptXmlPath
		});
		const partitions = partitionDefinitions({
			partitionList: PARTITIONS_TO_BACKUP,
			partitionTable,
			deviceId,
			dir: inputDir
		});
		await this.verifyFilesExist(partitions);

		const xmlFile = await generateXml({ partitions, tempPath, operation: 'program' });

		const files = [
			firehosePath,
			xmlFile
		];
		try {
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

	async verifyFilesExist(partitions) {
		for (const partition of partitions) {
			if (!await fs.exists(partition.filename)) {
				throw new Error(`File ${partition.filename} does not exist`);
			}
		}
	}
};
