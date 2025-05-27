const fs = require('fs-extra');
const os = require('os');
const { getEdlDevices } = require('particle-usb');
const { delay } = require('./utilities');
const DEVICE_READY_WAIT_TIME = 500; // ms
const UI = require('./ui');
const QdlFlasher = require('./qdl');
const path = require('path');
const GPT = require('gpt');
const temp = require('temp').track();
const FSG_PARTITION = 'fsg';
const REGION_NA_MARKER = Buffer.from('SG560D-NA');
const REGION_ROW_MARKER = Buffer.from('SG560D-EM');
const EFS_PARTITION_HEADER = Buffer.from('EFS');
const wifiMacScanner = require('./wifi-scanner');
const VError = require('verror');
const chalk = require('chalk');
const inquirer = require('inquirer');
const wifiScan = require('node-wifiscanner2').scan;

function addLogHeaders({ outputLog, startTime, deviceId, commandName }) {
	fs.appendFileSync(outputLog, `Tachyon Logs:${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `Command: ${commandName}${os.EOL}`);
	fs.appendFileSync(outputLog, `Using Device ID: ${deviceId}${os.EOL}`);
	fs.appendFileSync(outputLog, `Start time: ${startTime.toISOString()}${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
}

function addManifestInfoLog({ outputLog, manifest }) {
	if (!manifest) {
		return;
	}
	fs.appendFileSync(outputLog, `Manifest Info:${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `Release name: ${manifest.release_name || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Version: ${manifest.version || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Region: ${manifest.region || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Variant: ${manifest.variant || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Platform: ${manifest.platform || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Board: ${manifest.board || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `OS: ${manifest.os || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Distribution: ${manifest.distribution || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Distribution version: ${manifest.distribution_version || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Distribution variant: ${manifest.distribution_variant || ''}${os.EOL}`);
	fs.appendFileSync(outputLog, `Build date: ${manifest.build_date || ''}${os.EOL}`);
}

function addLogFooter({ outputLog, startTime, endTime }) {
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `Process Done${os.EOL}`);
	fs.appendFileSync(outputLog, `End Time: ${endTime.toISOString()}${os.EOL}`);
	fs.appendFileSync(outputLog, `Duration: ${((endTime - startTime) / 1000).toFixed(2)}s${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `Tachyon Log Ended${os.EOL}`);
	fs.appendFileSync(outputLog, `==================${os.EOL}`);
	fs.appendFileSync(outputLog, `${os.EOL}`);
}

async function getEDLDevice({ ui = new UI() } = {}) {
	let edlDevices = [];
	let messageShown = false;
	while (edlDevices.length === 0) {
		try {
			edlDevices = await getEdlDevices();
			if (edlDevices.length > 0) {
				return edlDevices[0];
			}
			if (!messageShown) {
				if (ui) {
					ui.stdout.write(`Waiting for device to enter system update mode...${os.EOL}`);
				} else {
					console.log(`Waiting for device to enter system update mode...${os.EOL}`);
				}
				messageShown = true;
			}
		} catch (error) {
			// ignore error
		}
		await delay(DEVICE_READY_WAIT_TIME);
	}
}

async function prepareFlashFiles({ logFile, ui, partitionsList, dir = process.cwd(), deviceId, operation, checkFiles = false } = {}) {
	const { firehosePath, tempPath, gptXmlPath }  = await initFiles();

	const partitionTable = await readPartitionsFromDevice({
		logFile,
		ui,
		tempPath,
		firehosePath,
		gptXmlPath
	});
	const partitions = partitionDefinitions({
		partitionList: partitionsList,
		partitionTable,
		deviceId,
		dir
	});
	const partitionFilenames = partitions.reduce((acc, partition) => {
		acc[partition.label] = partition.filename;
		return acc;
	}, {});
	if (checkFiles) {
		await verifyFilesExist(partitions);
	}

	const xmlFile = await generateXml({ partitions, tempPath, operation });
	return { firehosePath, xmlFile, partitionTable, partitionFilenames };
}

async function initFiles() {
	const firehoseAsset = path.join(__dirname, '../../assets/qdl/firehose/prog_firehose_ddr.elf');
	const gptXmlAsset = path.join(__dirname, '../../assets/qdl/read_gpt.xml');
	const tempPath = await temp.mkdir('tachyon-init-files');
	const firehosePath = path.join(tempPath, 'prog_firehose_ddr.elf');
	const gptXmlPath = path.join(tempPath, 'read_gpt.xml');
	await fs.copyFile(firehoseAsset, firehosePath);
	await fs.copyFile(gptXmlAsset, gptXmlPath);
	return { firehosePath, gptXmlPath, tempPath };
}

async function readPartitionsFromDevice({ logFile, ui, tempPath, firehosePath, gptXmlPath }) {
	const files = [
		firehosePath,
		gptXmlPath
	];

	const qdl = new QdlFlasher({
		outputLogFile: logFile,
		files: files,
		updateFolder: tempPath,
		ui: ui,
		currTask: 'Read partitions',
		skipReset: true
	});
	await qdl.run();
	return parsePartitions({ gptPath: tempPath });
}

async function parsePartitions({ gptPath }) {
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

function partitionDefinitions({ partitionList, partitionTable, deviceId, dir }) {
	return partitionList.map((name) => {
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

async function verifyFilesExist(partitions) {
	for (const partition of partitions) {
		if (!await fs.exists(partition.filename)) {
			throw new Error(`File ${partition.filename} does not exist`);
		}
	}
}

async function generateXml({ partitions, operation, tempPath }) {
	const xmlContent = getXmlContent({ partitions, operation });
	const xmlFile = path.join(tempPath, `partitions_${operation}.xml`);
	await fs.writeFile(xmlFile, xmlContent);
	return xmlFile;
}

function getXmlContent({ partitions, operation = 'read' }) {
	const elements = partitions.map(partition => [
		`  <${operation}`,
		`    label="${partition.label}"`,
		`    physical_partition_number="${partition.physical_partition_number}"`,
		`    start_sector="${partition.start_sector}"`,
		`    num_partition_sectors="${partition.num_partition_sectors}"`,
		`    filename="${ partition.filename}"`,
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

async function getTachyonInfo({ outputLog, ui }) {
	const { id: deviceId } = await getEDLDevice();
	const partitionDir = await temp.mkdir();

	const { firehosePath, xmlFile, partitionTable, partitionFilenames } = await prepareFlashFiles({
		ui,
		logFile: outputLog,
		partitionsList: [FSG_PARTITION],
		dir: partitionDir,
		deviceId,
		operation: 'read'
	});
	const files = [
		firehosePath,
		xmlFile
	];
	const qdl = new QdlFlasher({
		outputLogFile: outputLog,
		files: files,
		ui: ui,
		currTask: 'Identify',
		skipReset: true,
	});
	await qdl.run();
	return getIdentification({ deviceId, partitionTable, partitionFilenames });
}

async function getIdentification({ deviceId, partitionTable, partitionFilenames }) {
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
	let manufacturingDataString;
	if (modemDataValid) {
		manufacturingDataString = 'Found';
	} else {
		manufacturingDataString = 'Missing';
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

	return {
		deviceId,
		region: regionString,
		manufacturingData: manufacturingDataString,
		osVersion
	};
}

async function promptWifiNetworks(ui = new UI()) {
	const { ssids, networks } = await _scanNetworks(ui);
	const otherNetworkLabel = '[Other Network]';
	const rescanLabel = '[Rescan networks]';

	const choices =[
		new inquirer.Separator(),
		rescanLabel,
		new inquirer.Separator(),
		otherNetworkLabel,
		new inquirer.Separator(),
		...ssids
	];
	const question = [
		{
			type: 'list',
			name: 'ssid',
			message: chalk.bold.white('Select the Wi-Fi network with which you wish to connect your device:'),
			choices
		}];
	const { ssid } = await ui.prompt(question);
	if (ssid === rescanLabel) {
		return promptWifiNetworks(ui);
	}
	const pickedSSID = ssid === otherNetworkLabel ?
		(await _requestWifiSSID(ui)).ssid
		: ssid;

	const password = await _requestWifiPassword({ ui, ssid, networks });

	return { ssid: pickedSSID, password };
}

async function _scanNetworks(ui) {
	const networks = await ui.showBusySpinnerUntilResolved(
		'Scanning for nearby Wi-Fi networks...',
		_wifiScan()
	) || [];
	const ssids = networks?.map(n => n.ssid);
	return { networks, ssids };
}

async function _wifiScan() {
	let networks = [];
	networks = await new Promise((resolve, reject) => {
		wifiScan((err, networkList) => {
			if (err) {
				return reject(new VError('Unable to scan for Wi-Fi networks. Do you have permission to do that on this system?'));
			}
			resolve(networkList);
		});
	});
	if (networks?.length === 1 && !networks[0].ssid && os.platform() === 'darwin') {
		networks = await wifiMacScanner.scan();
	}
	return networks;
}

async function _requestWifiSSID(ui) {
	const questions = [
		{
			type: 'input',
			name: 'ssid',
			message: 'Enter your WiFi SSID:'
		}
	];
	const { ssid } = await ui.prompt(questions);
	return { ssid };
}

async function _requestWifiPassword({ ui, ssid, networks }) {
	const network = networks.find((n) => n.ssid === ssid);
	const isOpen = network?.security === 'none' || network?.security === '';
	const isManualEntry = !network;
	const annotation = isManualEntry ? ' (leave it blank for open networks)': '';

	if (isOpen) {
		return '';
	}

	return ui.promptPasswordWithConfirmation({
		customMessage: `Enter your WiFi password:${annotation}`,
		customConfirmationMessage: `Re-enter your WiFi password:${annotation}`
	});
}

module.exports = {
	addLogHeaders,
	addManifestInfoLog,
	addLogFooter,
	getEDLDevice,
	prepareFlashFiles,
	getTachyonInfo,
	promptWifiNetworks
};
