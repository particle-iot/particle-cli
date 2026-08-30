'use strict';
const fs = require('fs-extra');
const os = require('os');
const semver = require('semver');
const { getEdlDevices } = require('particle-usb');
const { delay } = require('./utilities');
const unzip = require('unzipper');
const DEVICE_READY_WAIT_TIME = 500; // ms
const UI = require('./ui');
const QdlFlasher = require('./qdl');
const path = require('path');
const GPT = require('gpt');
const temp = require('temp').track();
const FSG_PARTITION = 'fsg';
const BOOT_A_PARTITION = 'boot_a';
const BOOT_B_PARTITION = 'boot_b';

const REGION_NA_MARKER = Buffer.from('SG560D-NA');
const REGION_ROW_MARKER = Buffer.from('SG560D-EM');
const EFS_PARTITION_HEADER = Buffer.from('EFS');
const UBUNTU_20_MARKER = Buffer.from('ANDROID');
const UBUNTU_24_MARKER = Buffer.from('UEFI');

const wifiMacScanner = require('./wifi-scanner');
const VError = require('verror');
const chalk = require('chalk');
const inquirer = require('inquirer');
const wifiScan = require('node-wifiscanner2').scan;
const { TachyonConnectionError } = require('./qdl');

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

async function getEDLDevice({ ui = new UI(), showSetupMessage = false } = {}) {
	const devices = await getEDLModeDevices(ui, showSetupMessage);
	if (devices.length === 1) {
		return devices[0];
	} else {
		return edlModePicker({ ui: ui, devices });
	}
}

async function prepareFlashFiles({ logFile, ui, partitionsList, dir = process.cwd(), device, operation, checkFiles = false, optionalPartitions = [], modifyPartitions = (partitions) => partitions } = {}) {
	const { firehosePath, tempPath, gptXmlPath } = await initFiles();

	const partitionTable = await readPartitionsFromDevice({
		logFile,
		ui,
		tempPath,
		firehosePath,
		gptXmlPath,
		device
	});
	const partitions = modifyPartitions(partitionDefinitions({
		partitionList: partitionsList,
		partitionTable,
		deviceId: device.id,
		dir,
		optionalPartitions
	}));
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

async function readPartitionsFromDevice({ logFile, ui, tempPath, firehosePath, gptXmlPath, device }) {
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
		skipReset: true,
		serialNumber: device.serialNumber
	});
	try {
		await qdl.run();
	} catch (error) {
		if (error instanceof TachyonConnectionError) {
			throw error;
		}
		// Ignore other errors as the gpt read will fail for LUN 6 for EVT devices.
		// If there was an actual error reading the partitions, it will trigger an error in parsePartitions.
	}
	await logLunCapacities({ gptPath: tempPath, logFile });
	return parsePartitions({ gptPath: tempPath });
}

/**
 * The real size of each LUN, straight off the device.
 *
 * The firehose resolves NUM_DISK_SECTORS against the actual LUN when it writes the
 * GPT, so the header's backup-header LBA is the last sector that LUN has -- the
 * provisioning XML only ever states what was REQUESTED, which UFS rounds up to a
 * whole number of allocation units. This is therefore the authoritative answer to
 * "how big is LUN n on this device", and it costs nothing: the GPTs are already
 * on disk from the read above.
 */
async function readLunCapacities({ gptPath }) {
	const capacities = [];
	for (let i = 0; i <= 6; i++) {
		try {
			const buffer = await fs.readFile(path.join(gptPath, `gpt_main${i}.bin`));
			const gpt = new GPT({ blockSize: 4096 });
			gpt.parse(buffer, gpt.blockSize);
			// backupLBA is the last addressable sector, so the count is one more.
			capacities.push({ lun: i, sectors: Number(gpt.backupLBA) + 1 });
		} catch {
			// LUN 6 does not exist on EVT devices; a LUN we cannot read simply has
			// no reportable size.
		}
	}
	return capacities;
}

async function logLunCapacities({ gptPath, logFile }) {
	if (!logFile) {
		return;
	}
	try {
		const capacities = await readLunCapacities({ gptPath });
		if (!capacities.length) {
			return;
		}
		const lines = capacities.map(({ lun, sectors }) =>
			`  LUN ${lun}: ${sectors} sectors (${Math.round((sectors * 4096) / 1024 / 1024)} MiB)`
		);
		fs.appendFileSync(logFile, `UFS LUN geometry read from the device GPT:${os.EOL}${lines.join(os.EOL)}${os.EOL}`);
	} catch {
		// Diagnostics only: never fail a flash because the geometry could not be logged.
	}
}

async function parsePartitions({ gptPath }) {
	const table = [];
	for (let i = 0; i <= 6; i++) {
		const filename = path.join(gptPath, `gpt_main${i}.bin`);
		try {
			const buffer = await fs.readFile(filename);
			const gpt = new GPT({ blockSize: 4096 });
			const { partitions } = gpt.parse(buffer, gpt.blockSize);// partition table starts at 4096 bytes for Tachyon
			partitions.forEach((partition) => {
				table.push({ lun: i, partition });
			});
		} catch {
			if (i !== 6) {
				// LUN 6 does not exist on EVT devices, so ignore the error
				throw new Error(`Failed to parse partition table ${i} from device`);
			}
		}
	}
	return table;
}

function partitionDefinitions({ partitionList, partitionTable, deviceId, dir, optionalPartitions = [] }) {
	return partitionList.map((name) => {
		const entry = partitionTable.find(({ partition }) => partition.name === name);
		if (!entry) {
			if (optionalPartitions.includes(name)) {
				// Layouts differ across OS versions: 20.04 has boot_a/boot_b, the 24.04
				// layout does not. Callers that only sniff these for identification pass
				// them as optional so a missing one is absence, not a hard failure.
				return null;
			}
			throw new Error(`Partition ${name} not found in device partition table`);
		}
		return {
			label: entry.partition.name,
			physical_partition_number: entry.lun,
			start_sector: Number(entry.partition.firstLBA),
			num_partition_sectors: Number(entry.partition.lastLBA) - Number(entry.partition.firstLBA) + 1,
			filename: path.join(dir, `${deviceId}_${entry.partition.name}.backup`)
		};
	}).filter(Boolean);
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

async function getTachyonInfo({ outputLog, ui, device }) {
	if (!device) {
		const _device = await getEDLDevice();
		device = _device;
	}

	const partitionDir = await temp.mkdir();

	const { firehosePath, xmlFile, partitionTable, partitionFilenames } = await prepareFlashFiles({
		ui,
		logFile: outputLog,
		partitionsList: [FSG_PARTITION, BOOT_A_PARTITION, BOOT_B_PARTITION],
		optionalPartitions: [BOOT_A_PARTITION, BOOT_B_PARTITION],
		dir: partitionDir,
		device: device,
		operation: 'read',
		modifyPartitions: (partitions) => {
			return partitions.map((p) => {
				// we only need the first sector of these partitions to determine distribution version
				if ([BOOT_A_PARTITION, BOOT_B_PARTITION].includes(p.label)) {
					p.num_partition_sectors = 1;
				}
				return p;
			});
		}
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
		serialNumber: device.serialNumber
	});
	await qdl.run();
	return getIdentification({ deviceId: device.id, partitionTable, partitionFilenames });
}

async function getIdentification({ deviceId, partitionTable, partitionFilenames }) {
	const fsgBuffer = await fs.readFile(partitionFilenames[FSG_PARTITION]);
	const readIfPresent = async (name) => {
		const filename = partitionFilenames[name];
		return filename ? fs.readFile(filename) : Buffer.alloc(0);
	};
	const bootABuffer = await readIfPresent(BOOT_A_PARTITION);
	const bootBBuffer = await readIfPresent(BOOT_B_PARTITION);

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
	const ubuntu20 = bootABuffer.includes(UBUNTU_20_MARKER) || bootBBuffer.includes(UBUNTU_20_MARKER);
	const ubuntu24 = bootABuffer.includes(UBUNTU_24_MARKER) || bootBBuffer.includes(UBUNTU_24_MARKER);
	const hasVendorBoot = !!partitionTable.find(({ partition }) => partition.name.startsWith('vendor_boot'));
	const hasPartition = (name) => !!partitionTable.find(({ partition }) => partition.name === name);
	// The 24.04 layout dropped boot_a/boot_b and replaced the slotted system_a/system_b
	// with a single `system`. With no boot partition to sniff a marker from, that shape
	// is itself the identification.
	const noBootPartitions = !hasPartition(BOOT_A_PARTITION) && !hasPartition(BOOT_B_PARTITION);
	const singleSystem = hasPartition('system') && !hasPartition('system_a');
	let osVersion = 'Unknown';
	let board = 'formfactor_dvt';
	if (nvdataLun === 0) {
		osVersion = 'Ubuntu 20.04 EVT';
		board = 'formfactor';
	} else if (nvdataLun === 5) {
		if (hasVendorBoot) {
			osVersion = 'Android 14';
		} else if (ubuntu20 && !ubuntu24) {
			osVersion = 'Ubuntu 20.04';
		} else if (ubuntu24 && !ubuntu20) {
			osVersion = 'Ubuntu 24.04';
		} else if (noBootPartitions && singleSystem) {
			osVersion = 'Ubuntu 24.04';
		}
	}

	return {
		deviceId,
		region: regionString,
		manufacturingData: manufacturingDataString,
		osVersion,
		board
	};
}

async function promptWifiNetworks(ui = new UI()) {
	const { ssids, networks } = os.platform() !== 'darwin' ? await _scanNetworks(ui) : { ssids: null, networks: null }; // skip scanning on macOS due to errors and just show manual entry option
	const otherNetworkLabel = '[Other Network]';
	const rescanLabel = '[Rescan networks]';
	let ssid;

	if (networks) { // error when trying to get networks or macOS returning null since we skip it, so just show manual entry option
		const choices = [
			...ssids,
			otherNetworkLabel,
			rescanLabel,
			new inquirer.Separator(),
		];
		const question = [
			{
				type: 'list',
				name: 'ssid',
				message: chalk.bold.white('Select the Wi-Fi network with which you wish to connect your device:'),
				choices
			}];
		const { ssid: selected } = await ui.prompt(question);
		if (selected === rescanLabel) {
			return promptWifiNetworks(ui);
		}
		ssid = selected === otherNetworkLabel
			? (await _requestWifiSSID(ui)).ssid
			: selected;
	} else {
		ssid = (await _requestWifiSSID(ui)).ssid;
	}

	const password = await _requestWifiPassword({ ui, ssid, networks });

	return { ssid, password };
}

async function _scanNetworks(ui) {
	let networks;
	try {
		networks = await ui.showBusySpinnerUntilResolved(
			'Scanning for nearby Wi-Fi networks...',
			_wifiScan()
		);
	} catch (_err) {
		// something happened so need to call manual instead of rescanning
		const message = ui.chalk.yellow('Unable to scan Wi-Fi networks.');
		let description;
		if (os.platform() === 'win32') {
			description = ui.chalk.yellow('Make sure Location Services are enabled in ' +
				'the Location page of the  Privacy & security settings.');
		} else {
			description = ui.chalk.yellow('Ensure your system has the necessary permissions and tools to perform Wi-Fi scans.');
		}
		ui.write(`${message} ${description}`);
	}

	const ssids = networks
		? [...new Set(networks.map(n => n.ssid).filter(Boolean))]
		: undefined;
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
	const network = networks?.find((n) => n.ssid === ssid);
	const isOpen = network?.security === 'none' || network?.security === '';
	const isManualEntry = !network;
	const annotation = isManualEntry ? ' (leave it blank for open networks)' : '';

	if (isOpen) {
		return '';
	}

	return ui.promptPasswordWithConfirmation({
		customMessage: `Enter your WiFi password:${annotation}`,
		customConfirmationMessage: `Re-enter your WiFi password:${annotation}`
	});
}

async function getEDLModeDevices(ui, showSetupMessage) {
	let edlDevices = [];
	let devices;
	let messageShown = false;
	while (edlDevices.length === 0) {
		try {
			edlDevices = await getEdlDevices();
			if (edlDevices.length > 0) {
				devices = edlDevices;
				break;
			}
			if (!messageShown) {
				const defaultMessage = `Ensure your device is connected, then put it in system update mode...${os.EOL}`;
				const setupMessage = `${ui.chalk.bold('Before we get started, we need to power on your Tachyon board')}:` +
					`${os.EOL}${os.EOL}` +
					`1. Plug the USB-C cable into your computer and the Tachyon board.${os.EOL}` +
					`   The red light should turn on!${os.EOL}${os.EOL}` +
					`2. Put the Tachyon device into ${ui.chalk.bold('system update')} mode:${os.EOL}` +
					`   - Hold the button next to the red LED for 3 seconds.${os.EOL}` +
					`   - When the light starts flashing yellow, release the button.${os.EOL}`;
				ui.stdout.write(showSetupMessage ? setupMessage : defaultMessage);
				ui.stdout.write(os.EOL);
				messageShown = true;
			}
		} catch (_err) {
			// ignore error
		}
		await delay(DEVICE_READY_WAIT_TIME);
	}
	if (messageShown && showSetupMessage) {
		ui.stdout.write(`Your device is now in ${ui.chalk.bold('system update')} mode!${os.EOL}`);
		await delay(1000); // give the user a moment to read the message
	}
	return devices;
}

async function edlModePicker({ ui, devices }) {
	const choices = devices.map(device => device.id);
	const question = [
		{
			type: 'list',
			name: 'deviceId',
			message: chalk.bold.white('Select a device'),
			choices
		}];
	const { deviceId: selected } = await ui.prompt(question);
	return devices.find((device) => device.id === selected);
}

async function handleFlashError({ error, ui }) {
	if (error instanceof TachyonConnectionError) {
		ui.write(
			ui.chalk.yellow(`Device not responding ${os.EOL}`) +
			`Please turn it off completely: ${os.EOL}` +
			`    1. Remove the battery and USB-C cable ${os.EOL}` +
			`    2. Wait 30 seconds ${os.EOL}` +
			`    3. Reconnect both ${os.EOL}${os.EOL}` +
			'Press Enter once you\'re ready to retry.'
		);
		const question = {
			type: 'confirm',
			name: 'retry',
			message: 'Retry?',
			default: true
		};
		return ui.prompt([question]);
	}
	return false;
}

/**
 *
 * @param ui
 * @return {Promise<Workflow>}
 */
async function promptOSSelection({ ui, workflows }) {
	const choices = Object.values(workflows);
	const question = [{
		type: 'list',
		name: 'osType',
		message: ui.chalk.bold.white('Select the OS Type to setup in your device'),
		choices
	}];
	const { osType } = await ui.prompt(question);
	return workflows[osType];
}

async function isFile(version) {
	const validChannels = ['latest', 'stable', 'beta', 'rc'];
	const isValidChannel = validChannels.includes(version);
	const isValidSemver = semver.valid(version);
	const isFile = !isValidChannel && !isValidSemver;

	// access(OK
	if (isFile) {
		try {
			await fs.access(version, fs.constants.F_OK | fs.constants.R_OK);
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new Error(`The file "${version}" does not exist.`);
			} else if (error.code === 'EACCES') {
				throw new Error(`The file "${version}" is not accessible (permission denied).`);
			}
			throw error;
		}
	}
	return isFile;
}

async function readManifestFromLocalFile(path, targetFile = 'manifest.json') {
	const directory = await unzip.Open.file(path);
	const entry = directory.files.find(f => f.path.endsWith(targetFile));

	if (!entry) {
		throw new Error(`File "${targetFile}" not found in ${path}`);
	}
	// Stream and parse
	const content = await entry.buffer();
	try {
		return JSON.parse(content.toString('utf8'));
	} catch (err) {
		throw new VError(err, `Invalid JSON in ${targetFile}`);
	}
}

const IMAGE_MANIFEST_FILE = 'manifest.json';
// The first-boot configuration blob lives in `misc`: 1MiB at a 4096-byte sector.
const CONFIG_PARTITION = 'misc';
const CONFIG_PARTITION_SECTORS = 256;
const SECTOR_SIZE_IN_BYTES = 4096;

function xmlAttr(attrs, name) {
	const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
	return m ? m[1] : undefined;
}

/**
 * Parse the flat, attribute-only Qualcomm rawprogram grammar into partition
 * extents. Sector values may be ptool expressions ("NUM_DISK_SECTORS-5.") which
 * only resolve against a real device, so those entries are skipped.
 * @param {string[]} xmlContents  rawprogramN.xml sources
 * @returns {Map<string, {lun: number, startSector: number, numSectors: number}>}
 */
function parseRawProgramPartitions(xmlContents) {
	const table = new Map();
	for (const xml of xmlContents) {
		const re = /<(?:program|erase)\b([^>]*?)\/?>/g;
		let match;
		while ((match = re.exec(xml)) !== null) {
			const attrs = match[1];
			const label = xmlAttr(attrs, 'label');
			const start = Number(xmlAttr(attrs, 'start_sector'));
			const num = Number(xmlAttr(attrs, 'num_partition_sectors'));
			const lun = Number(xmlAttr(attrs, 'physical_partition_number'));
			if (!label || !Number.isFinite(start) || !Number.isFinite(num) || !Number.isFinite(lun)) {
				continue;
			}
			const prev = table.get(label);
			// An erase entry carries the whole declared extent and each program
			// chunk its own slice, so the footprint is the union of both.
			if (!prev) {
				table.set(label, { lun, startSector: start, numSectors: num });
			} else {
				const startSector = Math.min(prev.startSector, start);
				const end = Math.max(prev.startSector + prev.numSectors, start + num);
				table.set(label, { lun: prev.lun, startSector, numSectors: end - startSector });
			}
		}
	}
	return table;
}

/**
 * The partition table a system image DECLARES, read from the rawprogram XMLs its
 * manifest points at.
 *
 * This is the layout the device will have AFTER the image is flashed, which is
 * why a pre-flash check has to be made against it: the live GPT still describes
 * the OUTGOING layout, and on a 20.04 -> 24.04 setup the two differ.
 *
 * @param {Object} args
 * @param {string} args.imagePath  a system image zip, or an unpacked image directory
 */
async function readPartitionsFromImage({ imagePath }) {
	const stats = await fs.stat(imagePath);
	let manifest;
	let xmlContents;

	if (stats.isDirectory()) {
		manifest = JSON.parse(await fs.readFile(path.join(imagePath, IMAGE_MANIFEST_FILE), 'utf8'));
		const base = manifest?.targets?.[0]?.qcm6490?.edl?.base || '.';
		const programXml = manifest?.targets?.[0]?.qcm6490?.edl?.program_xml || [];
		xmlContents = await Promise.all(
			programXml.map((f) => fs.readFile(path.join(imagePath, base, f), 'utf8'))
		);
	} else {
		const dir = await unzip.Open.file(imagePath);
		const manifestEntry = dir.files.find((f) => path.basename(f.path) === IMAGE_MANIFEST_FILE);
		if (!manifestEntry) {
			throw new Error(`Unable to find ${IMAGE_MANIFEST_FILE} in ${imagePath}`);
		}
		manifest = JSON.parse((await manifestEntry.buffer()).toString());
		const programXml = manifest?.targets?.[0]?.qcm6490?.edl?.program_xml || [];
		xmlContents = [];
		for (const name of programXml) {
			const entry = dir.files.find((f) => f.path.endsWith(name));
			if (!entry) {
				throw new Error(`Unable to find ${name} in ${imagePath}`);
			}
			xmlContents.push((await entry.buffer()).toString());
		}
	}

	return parseRawProgramPartitions(xmlContents);
}

module.exports = {
	addLogHeaders,
	addManifestInfoLog,
	addLogFooter,
	getEDLDevice,
	prepareFlashFiles,
	getTachyonInfo,
	promptWifiNetworks,
	handleFlashError,
	promptOSSelection,
	isFile,
	readManifestFromLocalFile,
	readPartitionsFromImage,
	readLunCapacities,
	parseRawProgramPartitions,
	partitionDefinitions,
	getIdentification,
	CONFIG_PARTITION,
	CONFIG_PARTITION_SECTORS,
	SECTOR_SIZE_IN_BYTES
};
