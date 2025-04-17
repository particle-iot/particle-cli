const CLICommandBase = require('./base');
const QdlFlasher = require('../lib/qdl');
const path = require('path');
const temp = require('temp').track();
const fs = require('fs-extra');
const { getEdlDevices } = require('particle-usb');
const os = require('os');
const GPT = require('gpt');
const { delay } = require('../lib/utilities');
const DEVICE_READY_WAIT_TIME = 5000;

const PARTITIONS_TO_BACKUP = ['nvdata1', 'nvdata2', 'fsc', 'fsg', 'modemst1', 'modemst2'];

module.exports = class BackupRestoreTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
		this.firehosePath = path.join(__dirname, '../../assets/qdl/firehose/prog_firehose_ddr.elf');
		this.gptXmlPath = path.join(__dirname, '../../assets/qdl/read_gpt.xml');
	}

	async backup({ 'output-dir': outputDir = process.cwd(), 'log-dir': logDir = process.cwd() } = {}) {
		const deviceId = await this._getEDLDeviceId();
		if (!await fs.exists(outputDir)) {
			await fs.mkdir(outputDir, { recursive: true });
		}
		if (!await fs.exists(logDir)) {
			await fs.mkdir(logDir, { recursive: true });
		}

		this.ui.stdout.write(`Backing up NV data from device ${deviceId}...${os.EOL}`);

		const partitionTable = await this.readPartitionsFromDevice({ logDir, deviceId });
		const partitions = this.partitionDefinitions({ partitionTable, deviceId, dir: outputDir });

		const xmlFile = await this.generateXml({ partitions, operation: 'read' });
		const files = [
			this.firehosePath,
			xmlFile
		];

		const qdl = new QdlFlasher({
			outputLogFile: path.join(logDir, `tachyon_${deviceId}_backup_${Date.now()}.log`),
			files: files,
			ui: this.ui,
			currTask: 'Backup',
			skipReset: true,
		});
		await qdl.run();
		this.ui.stdout.write(`Backing up NV data from device ${deviceId} complete!${os.EOL}`);
	}

	async restore({
		'input-dir': inputDir = process.cwd(),
		'log-dir': logDir = process.cwd(),
	} = {})	{
		const deviceId = await this._getEDLDeviceId();
		if (!await fs.exists(logDir)) {
			await fs.mkdir(logDir, { recursive: true });
		}

		this.ui.stdout.write(`Restoring NV data to device ${deviceId}...${os.EOL}`);

		const partitionTable = await this.readPartitionsFromDevice({ logDir, deviceId });
		const partitions = this.partitionDefinitions({ partitionTable, deviceId, dir: inputDir });
		await this.verifyFilesExist(partitions);

		const xmlFile = await this.generateXml({ partitions, operation: 'program' });
		const files = [
			this.firehosePath,
			xmlFile
		];
		const qdl = new QdlFlasher({
			outputLogFile: path.join(logDir, `tachyon_${deviceId}_restore_${Date.now()}.log`),
			files: files,
			ui: this.ui,
			currTask: 'Restore',
			skipReset: true,
		});
		await qdl.run();
		this.ui.stdout.write(`Restoring NV data to device ${deviceId} complete!${os.EOL}`);
	}

	async readPartitionsFromDevice({ logDir, deviceId }) {
		const gptPath = await temp.mkdir('tachyon-gpt');
		const xmlFile = path.join(gptPath, 'read_gpt.xml');
		await fs.copyFile(this.gptXmlPath, xmlFile);

		const files = [
			this.firehosePath,
			xmlFile
		];

		const qdl = new QdlFlasher({
			outputLogFile: path.join(logDir, `tachyon_${deviceId}_gpt_${Date.now()}.log`),
			files: files,
			updateFolder: gptPath,
			ui: this.ui,
			currTask: 'Read partitions',
			skipReset: true,
		});
		await qdl.run();

		return this.parsePartitions({ gptPath });
	}

	async parsePartitions({ gptPath }) {
		const table = [];
		for (let i = 0; i <= 5; i++) {
			const filename = path.join(gptPath, `gpt_main${i}.bin`);
			const buffer = await fs.readFile(filename);
			try {
				const gpt = new GPT({ blockSize: 4096 });
				const { partitions } = gpt.parse(buffer, gpt.blockSize);  // partition table starts at 4096 bytes for Tachyon
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
		const tempFile = await temp.open({ suffix: '.xml' });
		await fs.write(tempFile.fd, xmlContent, 0, xmlContent.length, 0);
		await fs.close(tempFile.fd);
		return tempFile.path;
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

	async _getEDLDeviceId() {
		let edlDevices = [];
		let messageShown = false;
		while (edlDevices.length === 0) {
			try {
				edlDevices = await getEdlDevices();
				if (edlDevices.length > 0) {
					return edlDevices[0].id;
				}
				if (!messageShown) {
					this.ui.stdout.write(`Waiting for device to enter EDL mode...${os.EOL}`);
					messageShown = true;
				}
			} catch (error) {
				// ignore error
			}
			await delay(DEVICE_READY_WAIT_TIME);
		}
	}

};
