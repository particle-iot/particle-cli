const CLICommandBase = require('./base');
const QdlFlasher = require('../lib/qdl');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const temp = require('temp').track();
const {
	getEDLDevice,
	prepareFlashFiles
} = require('../lib/tachyon-utils');

const FSG_PARTITION = 'fsg';
const REGION_NA_MARKER = Buffer.from('SG560D-NA');
const REGION_ROW_MARKER = Buffer.from('SG560D-EM');
const EFS_PARTITION_HEADER = Buffer.from('EFSSuper');

module.exports = class IdentifyTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
	}

	async identify() {
		const { id: deviceId } = await getEDLDevice({ ui: this.ui });
		const outputLog = path.join(os.tmpdir(), `tachyon_${deviceId}_identify_${Date.now()}.log`);
		const partitionDir = await temp.mkdir();

		try {
			const { firehosePath, xmlFile, partitionTable, partitionFilenames } = await prepareFlashFiles({
				logFile: outputLog,
				ui: this.ui,
				partitionsList: [FSG_PARTITION],
				dir: partitionDir,
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
				currTask: 'Identify',
				skipReset: true,
			});
			await qdl.run();

			await this.printIdentifion({ deviceId, partitionTable, partitionFilenames });
		} catch (error) {
			this.ui.stdout.write(`An error ocurred while trying to identify your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information ${os.EOL}`);
		}
	}

	async printIdentifion({ deviceId, partitionTable, partitionFilenames }) {
		/*
		Region:
			- Search in fsg backup for the string SG560D-NA -> region is NA
			- Search in fsg backup for the string SG560D-EM -> region is RoW
			-	Else -> region is unknown

		Modem data:
			- Search in fsg backup for the string EFSSuper -> Modem data is present
			- Else -> Modem data is erased

		OS Version:
			- Read GPT
			- Check the physical partition number (LUN) for nvdata1.
			- If nvdata1 in LUN 0 -> OS version is Ubuntu 20.04 EVT
			- If nvdata1 is LUN 5 -> OS version is Ubuntu 20.04
			- Else -> OS version is unknown
		*/

		const fsgFilename = partitionFilenames[FSG_PARTITION];
		const fsgBuffer = await fs.readFile(fsgFilename);

		const regionNa = fsgBuffer.includes(REGION_NA_MARKER);
		const regionRow = fsgBuffer.includes(REGION_ROW_MARKER);
		let regionString;
		if (regionNa) {
			regionString = 'NA';
		} else if (regionRow) {
			regionString = 'RoW';
		} else {
			regionString = 'Unknown';
		}

		const modemDataValid = fsgBuffer.includes(EFS_PARTITION_HEADER);
		let modemDataString;
		if (modemDataValid) {
			modemDataString = 'Present';
		} else {
			modemDataString = 'Erased';
		}

		const nvdataLun = partitionTable.find(({ partition }) => partition.name === 'nvdata1')?.lun;
		let osVersion;
		if (nvdataLun === 0) {
			osVersion = 'Ubuntu 20.04 EVT';
		} else if (nvdataLun === 5) {
			osVersion = 'Ubuntu 20.04';
		} else {
			osVersion = 'Unknown';
		}

		this.ui.stdout.write(`Device ID: ${deviceId}${os.EOL}`);
		this.ui.stdout.write(`Region: ${regionString}${os.EOL}`);
		this.ui.stdout.write(`Modem data: ${modemDataString}${os.EOL}`);
		this.ui.stdout.write(`OS Version: ${osVersion}${os.EOL}`);
	}
};
