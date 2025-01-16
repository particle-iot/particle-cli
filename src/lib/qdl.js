const execa = require('execa');
const utilities = require('../lib/utilities');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const util = require('util');
const temp = require('temp').track();
const mkdirTemp = util.promisify(temp.mkdir);

const TACHYON_STORAGE_TYPE = 'ufs';

async function getExecutable() {
	const archType = utilities.getArchType();
	const archName = utilities.getOs();
	const qdlDir = path.join(__dirname, `../../assets/qdl/${archName}/${archType}`);
	if (!await fs.pathExists(qdlDir)) {
		throw new Error('Flashing Tachyon is not suppported on your OS');
	}

	// Copy qdl to a temporary directory, so it can run outside the pkg snapshot
	const tmpDir = await mkdirTemp('qdl');
	await fs.copy(qdlDir, tmpDir);

	return path.join(tmpDir, 'qdl' + (archName === 'win32' ? '.exe' : ''));
}

async function run({ files, includeDir, updateFolder, zip, ui, outputLogFile }) {
	const qdlPath = await getExecutable();

	const qdlArguments = [
		'--storage', TACHYON_STORAGE_TYPE,
		...(zip ? ['--zip', zip] : []),
		...(includeDir ? ['--include', includeDir] : []),
		...files
	];

	const progressBar = ui.createProgressBar();
	let currentModuleName = '', currentModuleSectors = 0;
	let totalSectorsInAllFiles = 0, totalSectorsFlashed = 0, progressBarInitialized = false;

	const handleError = (process, message) => {
		progressBar.stop();
		ui.stdout.write(message);
		process.kill();
	};

	const processLogLine = (line, process) => {
		fs.appendFileSync(outputLogFile, `${line}\n`);

		if (line.includes('Waiting for EDL device')) {
			handleError(process, `Device is not in EDL mode${os.EOL}`);
		} else if (line.includes('[ERROR]')) {
			handleError(process, `${os.EOL}Error detected: ${line}${os.EOL}`);
		} else if (line.includes('status=getProgramInfo')) {
			const match = line.match(/sectors_total=(\d+)/);
			if (match) {
				totalSectorsInAllFiles += parseInt(match[1], 10);
			}
		} else if (line.includes('status=Start flashing module')) {
			const moduleNameMatch = line.match(/module=(.*?),/);
			const sectorsTotalMatch = line.match(/sectors_total=(\d+)/);
			if (moduleNameMatch && sectorsTotalMatch) {
				currentModuleName = moduleNameMatch[1];
				currentModuleSectors = parseInt(sectorsTotalMatch[1], 10);

				if (!progressBarInitialized) {
					progressBarInitialized = true;
					progressBar.start(totalSectorsInAllFiles, totalSectorsFlashed, { description: `Flashing ${currentModuleName}` });
				} else {
					progressBar.update(totalSectorsFlashed, { description: `Flashing ${currentModuleName}` });
				}
			}
		} else if (line.includes('status=Flashing module')) {
			const sectorsFlashedMatch = line.match(/sectors_done=(\d+)/);
			if (sectorsFlashedMatch) {
				const sectorsFlashed = parseInt(sectorsFlashedMatch[1], 10);
				progressBar.update(totalSectorsFlashed + sectorsFlashed, { description: `Flashing module: ${currentModuleName} (${sectorsFlashed}/${currentModuleSectors} sectors)` });

				if (sectorsFlashed === currentModuleSectors) {
					totalSectorsFlashed += currentModuleSectors;
					progressBar.update({ description: `Flashed ${currentModuleName}` });
				}

				if (totalSectorsFlashed === totalSectorsInAllFiles) {
					progressBar.update({ description: 'Flashing complete' });
					progressBar.stop();
				}
			}
		}
	};

	try {
		const qdlProcess = execa(qdlPath, qdlArguments, { cwd: updateFolder || process.cwd(), stdio: 'pipe' });

		const handleStream = (stream) => {
			stream.on('data', chunk => {
				chunk.toString().split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
					processLogLine(line, qdlProcess);
				});
			});
		};

		handleStream(qdlProcess.stdout, 'stdout');
		handleStream(qdlProcess.stderr, 'stderr');

		await qdlProcess;
		return;
	} finally {
		progressBar.stop();
	}
}


module.exports = {
	run
};
