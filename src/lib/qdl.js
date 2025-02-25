const execa = require('execa');
const utilities = require('../lib/utilities');
const path = require('path');
const fs = require('fs-extra');
const util = require('util');
const temp = require('temp').track();
const mkdirTemp = util.promisify(temp.mkdir);
const os = require('os');

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

			await new Promise((resolve, reject) => {
				const handleStream = (stream) => {
					stream.on('data', chunk => {
						chunk.toString().split('\n').map(line => line.trim()).filter(Boolean).forEach(this.processLogLine.bind(this));
					});
				};

				handleStream(qdlProcess.stdout);
				handleStream(qdlProcess.stderr);

				qdlProcess.on('close', (output) => {
					if (output !== 0) {
						return reject(new Error('The device flashing failed, please check the logs for more information'));
					} else {
						return resolve();
					}
				});
				qdlProcess.on('error', reject);
			});
		} finally {
			if (this.progressBarInitialized) {
				this.progressBar.stop();
			}
			if (qdlProcess && qdlProcess.kill) {
				qdlProcess.kill();
			}
		}
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

	processLogLine(line) {
		fs.appendFileSync(this.outputLogFile, `${line}\n`);
		if (line.includes('Waiting for EDL device')) {
			const message = `Tachyon not found. Disconnect and reconnect the device, and ensure it is in EDL mode ${os.EOL}`;
			this.ui.stdout.write(this.ui.chalk.bold(this.ui.chalk.yellow(message)));
		} else if (line.includes('status=getProgramInfo')) {
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
