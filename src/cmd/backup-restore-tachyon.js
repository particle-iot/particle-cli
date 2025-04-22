const CLICommandBase = require('./base');
const QdlFlasher = require('../lib/qdl');
const path = require('path');
const temp = require('temp').track();
const fs = require('fs-extra');
const os = require('os');
const GPT = require('gpt');
const { addLogHeaders, getEDLDevice, addLogFooter } = require('../lib/tachyon-utils');

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
		await this.initFiles();

		const startTime = new Date();
		const outputLog = path.join(logDir, `tachyon_${deviceId}_backup_${Date.now()}.log`);

		this.ui.stdout.write(`Backing up NV data from device ${deviceId}...${os.EOL}`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		addLogHeaders({ outputLog, startTime, deviceId, commandName: 'Tachyon backup' });
		const partitionTable = await this.readPartitionsFromDevice({ logFile: outputLog });
		const partitions = this.partitionDefinitions({ partitionTable, deviceId, dir: outputDir });

		const xmlFile = await this.generateXml({ partitions, operation: 'read' });
		const files = [
			this.firehosePath,
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
		await this.initFiles();

		const startTime = new Date();
		const outputLog = path.join(logDir, `tachyon_${deviceId}_restore_${Date.now()}.log`);
		this.ui.stdout.write(`Restoring NV data to device ${deviceId}...${os.EOL}`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		addLogHeaders({ outputLog, startTime, deviceId, commandName: 'Tachyon restore' });
		const partitionTable = await this.readPartitionsFromDevice({ logFile: outputLog });
		const partitions = this.partitionDefinitions({ partitionTable, deviceId, dir: inputDir });
		await this.verifyFilesExist(partitions);

		const xmlFile = await this.generateXml({ partitions, operation: 'program' });

		const files = [
			this.firehosePath,
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

	async initFiles() {
		const firehoseAsset = path.join(__dirname, '../../assets/qdl/firehose/prog_firehose_ddr.elf');
		const gptXmlAsset = path.join(__dirname, '../../assets/qdl/read_gpt.xml');

		this.tempPath = await temp.mkdir('tachyon-backup');
		this.firehosePath = path.join(this.tempPath, 'prog_firehose_ddr.elf');
		this.gptXmlPath = path.join(this.tempPath, 'read_gpt.xml');

		await fs.copyFile(firehoseAsset, this.firehosePath);
		await fs.copyFile(gptXmlAsset, this.gptXmlPath);
	}

	async readPartitionsFromDevice({ logFile }) {
		const files = [
			this.firehosePath,
			this.gptXmlPath
		];


		const qdl = new QdlFlasher({
			outputLogFile: logFile,
			files: files,
			updateFolder: this.tempPath,
			ui: this.ui,
			currTask: 'Read partitions',
			skipReset: true,
		});
		await qdl.run();

		return this.parsePartitions({ gptPath: this.tempPath });
	}

	async parsePartitions({ gptPath }) {
		const table = [];
		for (let i = 0; i <= 5; i++) {
			const filename = path.join(gptPath, `gpt_main${i}.bin`);
			const buffer = await fs.readFile(filename);
			try {
				const gpt = new GPT({ blockSize: 4096 });
				const { partitions } = gpt.parse(buffer, gpt.blockSize);// partition table starts at 4096 bytes for Tachyon
				partitions.forEach((partition) => {
					table.push({ lun: i, partition });
				});
			} catch {
				throw new Error(`Failed to parse partition table ${i} from device`);
			}
		}
		return table;
	}

	partitionDefinitions({ partitionTable, deviceId, dir }) {
		return PARTITIONS_TO_BACKUP.map((name) => {
			const entry = partitionTable.find(({ partition }) => partition.name === name);
			if (!entry) {
				throw new Error(`Partition ${name} not found in device partition table`);
			}
			return {
				label: entry.partition.name,
				physical_partition_number: entry.lun,
				start_sector: Number(entry.partition.firstLBA),
				num_partition_sectors: Number(entry.partition.lastLBA) - Number(entry.partition.firstLBA) + 1,
				filename: path.join(dir, `${deviceId}_${entry.partition.name}.backup`)
			};
		});
	}

	async generateXml({ partitions, operation }) {
		const xmlContent = this.getXmlContent({ partitions, operation });
		const xmlFile = path.join(this.tempPath, `partitions_${operation}.xml`);
		await fs.writeFile(xmlFile, xmlContent);
		return xmlFile;
	}

	getXmlContent({ partitions, operation = 'read' }) {
		const elements = partitions.map(partition => [
			`  <${operation}`,
			`    label="${partition.label}"`,
			`    physical_partition_number="${partition.physical_partition_number}"`,
			`    start_sector="${partition.start_sector}"`,
			`    num_partition_sectors="${partition.num_partition_sectors}"`,
			`    filename="${partition.filename}"`,
			'    file_sector_offset="0"',
			'    SECTOR_SIZE_IN_BYTES="4096"',
			'  />'
		].join('\n')).join('\n');
		const xmlLines = [
			'<?xml version="1.0" encoding="utf-8"?>',
			'<data>',
			'  <!--NOTE: This is an ** Autogenerated file **-->',
			elements,
			'</data>',
			''
		];
		return xmlLines.join('\n');
	}
	async verifyFilesExist(partitions) {
		for (const partition of partitions) {
			if (!await fs.exists(partition.filename)) {
				throw new Error(`File ${partition.filename} does not exist`);
			}
		}
	}
};
