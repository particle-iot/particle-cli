'use strict';
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
const VError = require('verror');
const { compressDir, fileExists, sha256File } = require('../lib/utilities');
const { createHash } = require('crypto');

// Modem NV. `persist` is deliberately absent: the WLAN and BT MACs live in modem
// NV (read over AT with +QNVR), not there, and /persist holds only rmtfs symlinks
// that the device recreates -- and reformats -- on its own if they go missing.
const PARTITIONS_TO_BACKUP = ['nvdata1', 'nvdata2', 'fsc', 'fsg', 'modemst1', 'modemst2'];

// Sidecar describing what was captured, so a restore can verify the bytes instead
// of trusting six unlabelled blobs. Archives without it still restore.
const BACKUP_METADATA_FILE = 'backup.json';
const BACKUP_SCHEMA_VERSION = 1;
const SECTOR_SIZE_IN_BYTES = 4096;

module.exports = class BackupRestoreTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
		this._baseDir = settings.ensureFolder();
		this._logsDir = path.join(this._baseDir, 'logs');
		// Default to the Particle data directory rather than the working
		// directory: modem NV is not reproducible, and a backup left in whatever
		// folder the command happened to run from is one `cd` away from being lost.
		this._backupDir = path.join(this._baseDir, 'backups');
		this._setupApi();
	}

	async backup({ 'output-dir': outputDir = this._backupDir, 'log-dir': logDir = this._logsDir, existingLog } = {}) {
		const device = await getEDLDevice({ ui: this.ui });
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
			let sourcePartitions = [];
			const { firehosePath, xmlFile } = await prepareFlashFiles({
				logFile: outputLog,
				ui: this.ui,
				partitionsList: PARTITIONS_TO_BACKUP,
				dir: tmpOutputDir,
				device,
				operation: 'read',
				modifyPartitions: (partitions) => {
					sourcePartitions = partitions;
					return partitions;
				}
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
			await this._writeBackupMetadata({ dir: tmpOutputDir, deviceId: device.id, partitions: sourcePartitions });
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
			this.ui.stdout.write(
				`Restore it with: particle tachyon restore --filepath ${compressedFile.outputFile}${os.EOL}`
			);
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
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information ${os.EOL}`);
			throw error;
		} finally {
			addLogFooter({ outputLog, startTime, endTime: new Date() });
		}
	}

	async restore({
		'input-dir': inputDir = this._backupDir,
		'log-dir': logDir = this._logsDir,
		filepath,
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
		let zipFilePath;
		try {
			zipFilePath = await this._getFilePathToRestore({
				filepath,
				deviceId: device.id,
				inputDir
			});
			const tempPath = await this.extractZipFile(zipFilePath);
			// check the file unzip it in a temp and use it to prepare and flash.
			let targetPartitions = [];
			const { firehosePath, xmlFile } = await prepareFlashFiles({
				logFile: outputLog,
				ui: this.ui,
				partitionsList: PARTITIONS_TO_BACKUP,
				dir: tempPath,
				device,
				operation: 'program',
				checkFiles: true,
				modifyPartitions: (partitions) => {
					targetPartitions = partitions;
					return partitions;
				}
			});
			// Everything that can be checked without touching the device is checked
			// before the first byte is written: a half-written NV set is worse than
			// a refused restore.
			const metadata = await this._readBackupMetadata({ dir: tempPath, deviceId: device.id });
			await this._verifyBackupFiles({ partitions: targetPartitions, metadata });
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
			await this._verifyRestoredPartitions({ device, outputLog, partitions: targetPartitions });
			this.ui.stdout.write(`Restoring NV data to device ${device.id} complete!${os.EOL}`);

		} catch (error) {
			const { retry } = await handleFlashError({ error, ui: this.ui });
			if (retry) {
				return this.restore({
					'input-dir': inputDir,
					'log-dir': logDir,
					filepath,
					existingLog: outputLog,
				});
			}
			this.ui.stdout.write(
				`To retry by hand: particle tachyon restore --filepath ${zipFilePath || path.join(inputDir, `manufacturing_backup_${device.id}.zip`)}${os.EOL}`
			);
			this.ui.stdout.write(`An error ocurred while trying to restore up your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information ${os.EOL}`);
			throw error;
		} finally {
			addLogFooter({ outputLog, startTime, endTime: new Date() });
		}
	}

	/**
	 * Record what was captured alongside the blobs: which partition each file came
	 * from, how big it is and its digest. A restore can then prove it is writing
	 * the right bytes to the right place instead of trusting six unlabelled files.
	 */
	async _writeBackupMetadata({ dir, deviceId, partitions }) {
		const entries = [];
		for (const partition of partitions) {
			const file = path.basename(partition.filename);
			const exists = await fileExists(partition.filename);
			if (!exists) {
				continue;
			}
			const { size } = await fs.stat(partition.filename);
			entries.push({
				label: partition.label,
				file,
				lun: partition.physical_partition_number,
				startSector: partition.start_sector,
				numSectors: partition.num_partition_sectors,
				bytes: size,
				sha256: await sha256File(partition.filename)
			});
		}
		const metadata = {
			schemaVersion: BACKUP_SCHEMA_VERSION,
			deviceId,
			createdAt: new Date().toISOString(),
			sectorSize: SECTOR_SIZE_IN_BYTES,
			partitions: entries
		};
		await fs.writeJson(path.join(dir, BACKUP_METADATA_FILE), metadata, { spaces: 2 });
		return metadata;
	}

	/**
	 * Read the sidecar if the archive has one. Backups taken before it existed are
	 * still restorable -- they just get the size checks and none of the digests.
	 */
	async _readBackupMetadata({ dir, deviceId }) {
		const file = path.join(dir, BACKUP_METADATA_FILE);
		if (!await fileExists(file)) {
			this.ui.stdout.write(
				`This backup predates ${BACKUP_METADATA_FILE}; restoring without content verification.${os.EOL}`
			);
			return null;
		}
		const metadata = await fs.readJson(file);
		if (metadata.schemaVersion !== BACKUP_SCHEMA_VERSION) {
			throw new Error(
				`Unsupported ${BACKUP_METADATA_FILE} schema version ${metadata.schemaVersion}; this CLI understands ${BACKUP_SCHEMA_VERSION}.`
			);
		}
		if (metadata.deviceId && metadata.deviceId !== deviceId) {
			this.ui.stdout.write(this.ui.chalk.yellow(
				`Warning: this backup was taken from device ${metadata.deviceId}, not ${deviceId}.${os.EOL}`
			));
		}
		return metadata;
	}

	/**
	 * Refuse the restore unless every file is present, intact and small enough for
	 * the partition it is bound for. Checked up front so a mismatch never leaves
	 * the modem with half its NV replaced.
	 */
	async _verifyBackupFiles({ partitions, metadata }) {
		const byLabel = new Map((metadata?.partitions || []).map((p) => [p.label, p]));
		const problems = [];

		for (const partition of partitions) {
			const file = partition.filename;
			if (!await fileExists(file)) {
				problems.push(`${partition.label}: ${path.basename(file)} is missing from the backup`);
				continue;
			}
			const { size } = await fs.stat(file);
			const capacity = partition.num_partition_sectors * SECTOR_SIZE_IN_BYTES;
			if (size > capacity) {
				problems.push(
					`${partition.label}: ${size} bytes will not fit the ${capacity}-byte partition on this device`
				);
			}
			const recorded = byLabel.get(partition.label);
			if (!recorded) {
				continue;
			}
			if (recorded.bytes !== size) {
				problems.push(`${partition.label}: expected ${recorded.bytes} bytes, found ${size}`);
				continue;
			}
			const digest = await sha256File(file);
			if (recorded.sha256 && recorded.sha256 !== digest) {
				problems.push(`${partition.label}: sha256 ${digest} does not match the recorded ${recorded.sha256}`);
			}
		}

		if (problems.length) {
			throw new Error(`The backup cannot be restored to this device:${os.EOL}  - ${problems.join(`${os.EOL}  - `)}`);
		}
	}

	/**
	 * Read the partitions back off the device and compare them with what we just
	 * wrote. Only the first `bytes` of each read are compared: the read returns the
	 * whole partition, while the backup may be shorter than it.
	 */
	async _verifyRestoredPartitions({ device, outputLog, partitions }) {
		const verifyDir = await temp.mkdir('tachyon_restore_verify');
		const { firehosePath, xmlFile } = await prepareFlashFiles({
			logFile: outputLog,
			ui: this.ui,
			partitionsList: partitions.map((p) => p.label),
			dir: verifyDir,
			device,
			operation: 'read'
		});
		const qdl = new QdlFlasher({
			outputLogFile: outputLog,
			files: [firehosePath, xmlFile],
			ui: this.ui,
			currTask: 'Verify restore',
			skipReset: true,
			serialNumber: device.serialNumber,
		});
		await qdl.run();

		const mismatched = [];
		for (const partition of partitions) {
			const readBack = path.join(verifyDir, path.basename(partition.filename));
			if (!await fileExists(readBack)) {
				mismatched.push(`${partition.label}: could not be read back from the device`);
				continue;
			}
			const { size } = await fs.stat(partition.filename);
			const [expected, actual] = await Promise.all([
				this._sha256Prefix(partition.filename, size),
				this._sha256Prefix(readBack, size)
			]);
			if (expected !== actual) {
				mismatched.push(`${partition.label}: written bytes do not match the backup`);
			}
		}
		if (mismatched.length) {
			throw new Error(
				`Restore verification failed:${os.EOL}  - ${mismatched.join(`${os.EOL}  - `)}${os.EOL}` +
				'The device may have partially restored NV data; re-run the restore before using it.'
			);
		}
		fs.appendFileSync(outputLog, `Verified ${partitions.length} restored partitions${os.EOL}`);
	}

	/** sha256 of the first `length` bytes of a file. */
	_sha256Prefix(filePath, length) {
		return new Promise((resolve, reject) => {
			if (length === 0) {
				return resolve(createHash('sha256').digest('hex'));
			}
			const hash = createHash('sha256');
			const stream = fs.createReadStream(filePath, { start: 0, end: length - 1 });
			stream.on('data', (chunk) => hash.update(chunk));
			stream.on('end', () => resolve(hash.digest('hex')));
			stream.on('error', reject);
		});
	}

	async _getFilePathToRestore({ filepath, deviceId, inputDir }) {
		const defaultFileName = path.join(inputDir, `manufacturing_backup_${deviceId}.zip`);

		if (filepath) {
			const exists = await fileExists(filepath);
			if (exists) {
				this.ui.stdout.write(`Using zip file from ${filepath} ${os.EOL}`);
				return filepath;
			}
			throw new Error('Unable to find file at ' + filepath);
		}
		const defaultFileExists = await fileExists(defaultFileName);
		if (defaultFileExists) {
			this.ui.stdout.write(`Using zip file from ${defaultFileName} ${os.EOL}`);
			return defaultFileName;
		}
		// Backups taken before they were stored under the Particle data directory
		// landed in whatever directory the command ran from; still accept those.
		const legacyFileName = path.join(process.cwd(), `manufacturing_backup_${deviceId}.zip`);
		if (legacyFileName !== defaultFileName && await fileExists(legacyFileName)) {
			this.ui.stdout.write(`Using zip file from ${legacyFileName} ${os.EOL}`);
			return legacyFileName;
		}
		this.ui.stdout.write(`Downloading file at ${defaultFileName}${os.EOL}`);
		const resp = await this.api.downloadManufacturingBackup({ deviceId });
		const buffer = Buffer.from(resp);
		await fs.writeFile(defaultFileName, buffer);

		return defaultFileName;
	}

	async extractZipFile(filepath) {
		const tmpOutputDir = await temp.mkdir('tachyon_restore');

		try {
			// Extract everything into tmpOutputDir
			await fs.createReadStream(filepath)
				// eslint-disable-next-line new-cap
				.pipe(unzip.Extract({ path: tmpOutputDir }))
				.promise();

			return tmpOutputDir;
		} catch (err) {
			throw new VError(err, 'Zip file could not be extracted');
		}
	}


	_setupApi() {
		const { api } = this._particleApi();
		this.api = api;
	}

};
