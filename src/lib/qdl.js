const execa = require('execa');
const utilities = require('../lib/utilities');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const util = require('util');
const temp = require('temp').track();
const mkdirTemp = util.promisify(temp.mkdir);

const TACHYON_STORAGE_TYPE = 'ufs';

class QdlFlasher {
	constructor({ files, includeDir, updateFolder, zip, ui, outputLogFile, skipReset=false, currTask=null }) {
		this.files = files;
		this.includeDir = includeDir;
		this.updateFolder = updateFolder;
		this.zip = zip;
		this.ui = ui;
		this.outputLogFile = outputLogFile;
		this.progressBar = null;
		this.totalSectorsInAllFiles = 0;
		this.totalSectorsFlashed = 0;
		this.currentModuleName = '';
		this.currentModuleSectors = 0;
		this.progressBarInitialized = false;
		this.preparingDownload = false;
		this.skipReset = skipReset;
		this.currTask = currTask;
	}

	async run() {
		let qdlProcess;
		try {
			const qdlPath = await this.getExecutable();
			const qdlArguments = this.buildArgs({ files: this.files, includeDir: this.includeDir, zip: this.zip });
			this.progressBar = this.ui.createProgressBar();
			const command = `${qdlPath} ${qdlArguments.join(' ')}`;
			fs.appendFileSync(this.outputLogFile, `Command: ${command}\n`);

			qdlProcess = execa(qdlPath, qdlArguments, {
				cwd: this.updateFolder || process.cwd(),
				stdio: 'pipe'
			});

			const handleStream = (stream) => {
				stream.on('data', chunk => {
					chunk.toString().split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
						this.processLogLine(line, qdlProcess);
					});
				});
			};

			handleStream(qdlProcess.stdout);
			handleStream(qdlProcess.stderr);

			await qdlProcess;
		} finally {
			if (this.progressBarInitialized) {
				this.progressBar.stop();
			}
			if (qdlProcess && qdlProcess.kill) {
				qdlProcess.kill();
			}
		}
	}

	async waitUntilDeviceIsReady() {
		return this.ui.showBusySpinnerUntilResolved(
			'Tachyon not found. Disconnect and reconnect the device, and ensure it is in EDL mode...',
			new Promise((resolve, reject) => {
				const interval = setInterval(() => {
					if (!this.waitForDevice) {
						clearInterval(interval);
						resolve();
					}
				}, 500);

				// Optional timeout after 5 minutes
				setTimeout(() => {
					clearInterval(interval);
					reject(new Error('⏰ Device not detected within 5 minutes.'));
				}, 5 * 60 * 1000);
			})
		);
	}


	async getExecutable() {
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

	buildArgs({ files, includeDir, zip }) {
		return [
			'--storage', TACHYON_STORAGE_TYPE,
			...(zip ? ['--zip', zip] : []),
			...(includeDir ? ['--include', includeDir] : []),
			...files,
			...(this.skipReset ? ['--skip-reset'] : [])
		];
	}

	processLogLine(line, process) {
		fs.appendFileSync(this.outputLogFile, `${line}\n`);
		if (line.includes('Waiting for EDL device')) {
			this.ui.stdout.write('Tachyon not found. Disconnect and reconnect the device, and ensure it is in EDL mode.');
			this.waitForDevice = true;
			this.waitUntilDeviceIsReady();
		} else if (line.includes('[ERROR]')) {
			this.waitForDevice = false;
			this.handleError(process, `${os.EOL}Error detected: ${line}${os.EOL}`);
		} else {
			this.waitForDevice = false;
			this.processFlashingLogs(line);
		}
	}

	handleError(process, message) {
		this.ui.stdout.write(message);
		process.kill();
	}

	processFlashingLogs(line) {
		if (line.includes('status=getProgramInfo')) {
			this.handleProgramInfo(line);
		} else if (line.includes('status=Start flashing module')) {
			this.handleModuleStart(line);
		} else if (line.includes('status=Flashing module')) {
			this.handleModuleProgress(line);
		}
	}

	handleProgramInfo(line) {
		if (!this.preparingDownload) {
			this.preparingDownload = true;
			this.ui.stdout.write('Preparing to download files...');
		}
		const match = line.match(/sectors_total=(\d+)/);
		if (match) {
			this.totalSectorsInAllFiles += parseInt(match[1], 10);
		}
	}

	handleModuleStart(line) {
		const moduleNameMatch = line.match(/module=(.*?),/);
		const sectorsTotalMatch = line.match(/sectors_total=(\d+)/);
		if (moduleNameMatch && sectorsTotalMatch) {
			this.currentModuleName = moduleNameMatch[1];
			this.currentModuleSectors = parseInt(sectorsTotalMatch[1], 10);

			if (!this.progressBarInitialized) {
				this.progressBarInitialized = true;
				this.progressBar.start(this.totalSectorsInAllFiles, this.totalSectorsFlashed, {
					description: `Flashing ${this.currentModuleName}`
				});
			} else {
				this.progressBar.update(this.totalSectorsFlashed, {
					description: `Flashing ${this.currentModuleName}`
				});
			}
		}
	}

	handleModuleProgress(line) {
		const sectorsFlashedMatch = line.match(/sectors_done=(\d+)/);
		if (sectorsFlashedMatch) {
			const sectorsFlashed = parseInt(sectorsFlashedMatch[1], 10);
			this.progressBar.update(this.totalSectorsFlashed + sectorsFlashed, {
				description: `Flashing module: ${this.currentModuleName} (${sectorsFlashed}/${this.currentModuleSectors} sectors)`
			});

			if (sectorsFlashed === this.currentModuleSectors) {
				this.totalSectorsFlashed += this.currentModuleSectors;
				this.progressBar.update({ description: `Flashed ${this.currentModuleName}` });
			}

			if (this.totalSectorsFlashed === this.totalSectorsInAllFiles) {
				this.progressBar.update({ description: `Flashing complete ${this.currTask ? this.currTask : ''}` });
			}
		}
	}

}


module.exports = QdlFlasher;
