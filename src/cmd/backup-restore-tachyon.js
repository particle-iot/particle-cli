const CLICommandBase = require('./base');
const QdlFlasher = require('../lib/qdl');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const temp = require('temp').track();
const unzip = require('unzipper');
const {
	addLogHeaders,
	getEDLDevice,
	addLogFooter,
	prepareFlashFiles, handleFlashError
} = require('../lib/tachyon-utils');
const settings = require('../../settings');
const { compressDir, fileExists } = require('../lib/utilities');
const ParticleApi = require('./api');
const createApiCache = require('../lib/api-cache');

const PARTITIONS_TO_BACKUP = ['nvdata1', 'nvdata2', 'fsc', 'fsg', 'modemst1', 'modemst2'];

module.exports = class BackupRestoreTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
		this._baseDir = settings.ensureFolder();
		this._logsDir = path.join(this._baseDir, 'logs');
		this._setupApi();
	}

	async backup({ 'output-dir': outputDir = process.cwd(), 'log-dir': logDir = this._logsDir, existingLog } = {}) {
		const device  = await getEDLDevice({ ui: this.ui });
		const outputDirExist = await fs.exists(outputDir);
		const logDirExist = await fs.exists(logDir);
		if (!outputDirExist) {
			await fs.ensureDir(outputDir);
		}
		if (!logDirExist) {
			await fs.ensureDir(logDir);
		}

		const startTime = new Date();
		const outputLog = existingLog || path.join(logDir, `tachyon_${device.id}_backup_${Date.now()}.log`);

		this.ui.stdout.write(`Backing up NV data from device ${device.id}...${os.EOL}`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		addLogHeaders({ outputLog, startTime, deviceId: device.id, commandName: 'Tachyon backup' });
		try {
			const tmpOutputDir = await temp.mkdir('tachyon_backup');
			const { firehosePath, xmlFile } = await prepareFlashFiles({
				logFile: outputLog,
				ui: this.ui,
				partitionsList: PARTITIONS_TO_BACKUP,
				dir: tmpOutputDir,
				device,
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
				serialNumber: device.serialNumber
			});
			await qdl.run();
			// zip file
			const compressedFile = await compressDir({
				pathToCompress: tmpOutputDir,
				outputFile: `manufacturing_backup_${device.id}.zip`,
				outputDir: outputDir
			});
			fs.appendFileSync(outputLog, `==================${os.EOL}`);
			fs.appendFileSync(outputLog, `Backup Done${os.EOL}`);
			fs.appendFileSync(outputLog, `Created File: ${compressedFile.outputFile}${os.EOL}`);
			fs.appendFileSync(outputLog, `SHA256: ${compressedFile.sha256}${os.EOL}`);
			this.ui.stdout.write(`Created File: ${compressedFile.outputFile}${os.EOL}`);
			this.ui.stdout.write(`Backing up NV data from device ${device.id} complete!${os.EOL}`);
		} catch (error) {
			const { retry } = await handleFlashError({ error, ui: this.ui });
			if (retry) {
				return this.backup({
					'output-dir': outputDir,
					'log-dir': logDir,
					existingLog: outputLog,
				});
			}
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
		'force-cloud': forceCloud,
		filePath,
		existingLog
	} = {})	{
		const device = await getEDLDevice({ ui: this.ui });
		const logDirExist = await fs.exists(logDir);
		if (!logDirExist) {
			await fs.ensureDir(logDir);
		}

		const startTime = new Date();
		const outputLog = existingLog || path.join(logDir, `tachyon_${device.id}_restore_${Date.now()}.log`);
		this.ui.stdout.write(`Restoring NV data to device ${device.id}...${os.EOL}`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		addLogHeaders({ outputLog, startTime, deviceId: device.id, commandName: 'Tachyon restore' });
		try {
			const zipFilePath = await this._getFilePathToRestore({
				forceCloud,
				filePath,
				deviceId: device.id,
				inputDir
			});
			const tempPath = await this.extractZipFile(zipFilePath);
			// check the file unzip it in a temp and use it to prepare and flash.
			const { firehosePath, xmlFile } = await prepareFlashFiles({
				logFile: outputLog,
				ui: this.ui,
				partitionsList: PARTITIONS_TO_BACKUP,
				dir: tempPath,
				device,
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
				serialNumber: device.serialNumber,
			});
			await qdl.run();
			this.ui.stdout.write(`Restoring NV data to device ${device.id} complete!${os.EOL}`);

		} catch (error) {
			const { retry } = await handleFlashError({ error, ui: this.ui });
			if (retry) {
				return this.backup({
					'input-dir': inputDir,
					'log-dir': logDir,
					existingLog: outputLog,
				});
			}
			this.ui.stdout.write(`An error ocurred while trying to restore up your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information ${os.EOL}`);
		} finally {
			addLogFooter({ outputLog, startTime, endTime: new Date() });
		}
	}

	async _getFilePathToRestore({ forceCloud, filePath, deviceId, inputDir }) {
		const defaultFileName = path.join(inputDir, `manufacturing_backup_${deviceId}.zip`);
		const defaultFileExists = await fileExists(defaultFileName);
		if (filePath) {
			const exists = await fileExists(filePath);
			console.log(exists);
			if (await fileExists(filePath)) {
				this.ui.stdout.write(`Using zip file from ${filePath} ${os.EOL}`);
				return filePath;
			}
			this.ui.stdout.write(`Unable to find file at ${filePath} ${os.EOL}`);
			throw new Error('Unable to find file at ' + filePath);
		}
		if (forceCloud || !defaultFileExists) {
			this.ui.stdout.write(`Downloading file at ${defaultFileName}${os.EOL}`);
			const resp = await this.api.downloadManufacturingBackup({ deviceId });
			const buffer = Buffer.from(resp);
			await fs.writeFile(defaultFileName, buffer);
		}
		return defaultFileName;
	}

	async extractZipFile(filePath) {
		const tmpOutputDir = await temp.mkdir('tachyon_restore');

		let directory;
		try {
			// Try opening the zip — throws if not a zip
			directory = await unzip.Open.file(filePath);
		} catch (err) {
			throw new Error(`Invalid zip file: ${filePath}`); // in case there is no zip or so throw an error
		}
		const roots = new Set(directory.files.map(f => f.path.split('/')[0]));

		// Extract everything into tmpOutputDir
		await fs.createReadStream(filePath)
			// eslint-disable-next-line new-cap
			.pipe(unzip.Extract({ path: tmpOutputDir }))
			.promise();

		// Decide what to return
		if (roots.size === 1) {
			const [root] = Array.from(roots);
			const resolved = path.join(tmpOutputDir, root);
			return resolved;
		} else {
			return tmpOutputDir;
		}
	}

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}

	_setupApi() {
		const { api } = this._particleApi();
		this.api = api;
	}

};
