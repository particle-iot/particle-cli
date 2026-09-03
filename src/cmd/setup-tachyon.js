'use strict';
const VError = require('verror');
const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');
const fs = require('fs-extra');
const settings = require('../../settings');
const { getCurrentUsername } = require('../lib/api-call');
const { AuthenticationError } = require('../lib/auth-errors');
const os = require('os');

const DownloadManager = require('../lib/download-manager');
const path = require('path');
const {
	getTachyonInfo,
	getEDLDevice,
	handleFlashError,
	promptOSSelection,
	isFile,
	readManifestFromLocalFile,
	lookupCloudDeviceInfo
} = require('../lib/tachyon-utils');
const { TachyonConnectionError } = require('../lib/qdl');
const { workflows, workflowRun } = require('../lib/tachyon/workflow');

const showWelcomeMessage = (ui) => `
===================================================================================
			  Particle Tachyon Setup Command
===================================================================================

Welcome to the Particle Tachyon setup! This interactive command:

- Flashes your Tachyon device
- Configures it
- Connects it to the internet and the Particle Cloud!

${ui.chalk.bold('What you\'ll need:')}

1. Your Tachyon device
2. The Tachyon battery
3. A USB-C cable

${ui.chalk.bold('Important:')}
${ui.chalk.bold(`${os.EOL}`)}
- This tool requires you to be logged into your Particle account.
- For more details, check out the documentation at: https://part.cl/setup-tachyon ${os.EOL}`;

module.exports = class SetupTachyonCommands extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		spinnerMixin(this);
		this._setupApi();
		this.ui = ui || this.ui;
		this.device = null;
		this._baseDir = settings.ensureFolder();
		this._logsDir = path.join(this._baseDir, 'logs');
		this.downloadManager = new DownloadManager(this.ui);
		this.outputLog = null;
		this._hardwareOptionSources = {};
		this.defaultOptions = {
			version: settings.tachyonVersion || 'stable',
			distroVersion: '20.04',
			country: settings.profile_json.country || 'USA',
			variant: null,
			skipFlashingOs: false,
			skipCli: false,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // eslint-disable-line new-cap
			alwaysCleanCache: false,
			workflow: workflows.ubuntu20,
			flashSuccessful: true
		};
		this.options = {};
	}

	async setup({ skip_flashing_os: skipFlashingOs, timezone, load_config: loadConfig, save_config: saveConfig, region, version, variant, board, distro_version: distroVersion, skip_cli: skipCli } = {}) {
		const options = { skipFlashingOs, timezone, loadConfig, saveConfig, region, version, variant, board, distroVersion, skipCli };
		try {
			await this.ui.write(showWelcomeMessage(this.ui));
			// step 1 login
			this._formatAndDisplaySteps("Okay—first up! Checking if you're logged in...");
			this.ui.write('');
			this.ui.write(`...All set! You're logged in as ${this.ui.chalk.bold(await getCurrentUsername())} and ready to go!`);
			// step 2 get device info
			this._formatAndDisplaySteps("Now let's get the device info");
			this.ui.write('');
			const device = await getEDLDevice({ ui: this.ui, showSetupMessage: true });
			this.device = device;
			// ensure logs dir
			await fs.ensureDir(this._logsDir);
			this.outputLog = path.join(this._logsDir, `tachyon_flash_${this.device.id}_${Date.now()}.log`);
			await fs.ensureFile(this.outputLog);
			this.ui.write(`${os.EOL}Starting Process. See logs at: ${this.outputLog}${os.EOL}`);
			// EDL supplies the device ID without touching storage, so begin the cloud
			// lookup immediately while the slower best-effort local read runs.
			const cloudInfoPromise = lookupCloudDeviceInfo({ deviceId: this.device.id, api: this.api });
			const deviceInfo = await this._getDeviceInfo();
			deviceInfo.usbVersion = this.device.usbVersion.major;
			// check if there is a config file
			// validate version if local then workflow will be inferred from the manifest
			const isLocalVersion = version ? await isFile(version) : false;
			const cloudInfo = await cloudInfoPromise;
			const config = await this._loadConfig({ options, deviceInfo, cloudInfo, isLocalVersion });
			const resolvedDeviceInfo = {
				...deviceInfo,
				region: config.region,
				board: config.board
			};
			this._printDeviceInfo(resolvedDeviceInfo);

			const context = {
				...config,
				ui: this.ui,
				api: this.api,
				deviceInfo: resolvedDeviceInfo,
				device: this.device,
				log: {
					file: this.outputLog,
					info: (msg) => fs.appendFileSync(this.outputLog, `info: ${msg} ${os.EOL}`),
					error: (msg) => fs.appendFileSync(this.outputLog, `error: ${msg} ${os.EOL}`),
				}
			};

			const workflowContext = await workflowRun(config.workflow, context);
			if (workflowContext.saveConfig) {
				await this._saveConfig(workflowContext);
			}
		} catch (e) {
			if (e instanceof AuthenticationError) {
				throw e;
			}
			throw new VError(e, 'Tachyon setup failed');
		}
	}

	async _getDeviceInfo() {
		try {
			return await this.ui.showBusySpinnerUntilResolved('Getting device info', getTachyonInfo({
				outputLog: this.outputLog,
				ui: this.ui,
				device: this.device
			}));
		} catch (error) {
			if (error instanceof TachyonConnectionError) {
				const { retry } = await handleFlashError({ error, ui: this.ui });
				if (retry) {
					return this._getDeviceInfo();
				}
				throw new Error('Unable to communicate with the device. Please restart the device and try again.');
			}

			// Identification is useful for automatically preserving the region and board
			// type, but it describes the layout being replaced. A blank, corrupt, or new
			// GPT must not prevent an image containing its own GPT from being flashed.
			this.ui.write(this.ui.chalk.yellow(
				`Could not read the existing device layout: ${error.message}${os.EOL}` +
				`Continuing with the identity reported in EDL mode. Setup will use explicit ` +
				`options, a loaded configuration, Particle Cloud, or ask you.${os.EOL}`
			));
			return {
				deviceId: this.device.id,
				region: 'Unknown',
				manufacturingData: 'Unknown',
				osVersion: 'Unknown',
				board: 'Unknown'
			};
		}
	}

	async _printDeviceInfo(deviceInfo) {
		const sourceSuffix = (name) => {
			const source = this._hardwareOptionSources[name];
			return source && source !== 'device' ? ` (from ${source})` : '';
		};
		const boardNames = {
			formfactor: 'EVT',
			formfactor_dvt: 'DVT or later',
			rb3g2: 'Qualcomm RB3 Gen 2'
		};
		this.ui.write(this.ui.chalk.bold('Device info:'));
		this.ui.write(os.EOL);
		this.ui.write(` -  Device ID: ${deviceInfo.deviceId}`);
		this.ui.write(` -  Board: ${boardNames[deviceInfo.board] || deviceInfo.board}${sourceSuffix('board')}`);
		this.ui.write(` -  Region: ${deviceInfo.region}${sourceSuffix('region')}`);
		this.ui.write(` -  OS Version: ${deviceInfo.osVersion}`);
		let usbWarning = '';
		if (this.device.usbVersion.major <= 2) {
			usbWarning = this.ui.chalk.yellow(' (use a USB 3.0 port and USB-C cable for faster flashing)');
		}
		this.ui.write(` -  USB Version: ${this.device.usbVersion.major}.${this.device.usbVersion.minor}${usbWarning}`);
	}

	_formatAndDisplaySteps(text, step) {
		// Display the formatted step
		this.ui.write(`${os.EOL}===================================================================================${os.EOL}`);
		if (step) {
			this.ui.write(`Step ${step}:${os.EOL}`);
		}
		this.ui.write(`${text}`);
	}

	async _pickWorkflowToExecute() {
		this._formatAndDisplaySteps(`Choose an operating system to flash onto this device ${os.EOL}`);
		const workflow = await promptOSSelection({ ui: this.ui, workflows });
		if (workflow.selectionWarning) {
			this.ui.write(this.ui.chalk.yellow(workflow.selectionWarning));
		}
		return workflow;
	}

	/**
	 *
	 * @param {Workflow} selectedWorkflow
	 * @return {Promise<void>}
	 * @private
	 */
	async _loadConfig({ options, deviceInfo, cloudInfo, isLocalVersion }) {
		const configFromFile = await this._loadConfigFromFile(options.loadConfig);
		const hardwareOptions = await this._resolveHardwareOptions({
			options,
			configFromFile,
			deviceInfo,
			cloudInfo
		});

		const selectedWorkflow = await this._selectWorkflow({
			isLocalVersion,
			version: options.version,
			distroVersion: options.distroVersion,
			configFromFile,
			defaultWorkflow: this.defaultOptions.workflow
		});

		const cleanedOptions = Object.fromEntries(
			Object.entries(options).filter(([_, v]) => v !== undefined)
		);
		const config = {
			...this.defaultOptions,
			...selectedWorkflow?.overrideDefaults,
			...configFromFile,
			...cleanedOptions,
			...hardwareOptions,
			distroVersion: selectedWorkflow.osInfo.distributionVersion,
			workflow: selectedWorkflow,
			isLocalVersion: !!isLocalVersion
		};

		if (settings.isStaging) {
			config.apiServer = settings.apiUrl;
			config.server = 'https://edge.staging.particle.io';
			config.verbose = true;
		}

		if (!isLocalVersion) {
			config.manifest = await this._getManifestBuilds({
				version: config.version,
				osInfo: config.workflow.osInfo,
				region: config.region,
				board: config.board,
			});
		}

		return config;
	}

	/**
	 * Resolve region and board independently. The first known value wins:
	 *
	 *   1. command-line option (the operator's most explicit choice)
	 *   2. loaded setup configuration
	 *   3. the physical device's current partitions
	 *   4. the device's Particle Cloud record
	 *   5. interactive user input
	 *
	 * "Unknown" is not a value and never prevents a later source from answering.
	 * There is deliberately no implicit NA or DVT fallback: choosing the wrong
	 * region or board can select an incompatible image.
	 */
	async _resolveHardwareOptions({ options, configFromFile, deviceInfo, cloudInfo }) {
		const resolve = async (name, prompt) => {
			const candidates = [
				{ value: options?.[name], source: 'command line' },
				{ value: configFromFile?.[name], source: 'loaded configuration' },
				{ value: deviceInfo?.[name], source: 'device' },
				{ value: cloudInfo?.[name], source: 'Particle Cloud' }
			];
			const selected = candidates.find(({ value }) => this._isKnownHardwareOption(value));
			if (selected) {
				this._hardwareOptionSources[name] = selected.source;
				return selected.value;
			}
			const value = await prompt();
			this._hardwareOptionSources[name] = 'user input';
			return value;
		};

		return {
			region: await resolve('region', () => this._selectRegion()),
			board: await resolve('board', () => this._selectBoard())
		};
	}

	_isKnownHardwareOption(value) {
		return typeof value === 'string' && value.trim() !== '' && value.toLowerCase() !== 'unknown';
	}

	async _selectRegion() {
		const { region } = await this.ui.prompt([{
			type: 'list',
			name: 'region',
			message: 'Select the device region:',
			choices: [
				{ name: 'NA (North America)', value: 'NA' },
				{ name: 'RoW (Rest of the World)', value: 'RoW' }
			]
		}]);
		return region;
	}

	async _selectBoard() {
		const { board } = await this.ui.prompt([{
			type: 'list',
			name: 'board',
			message: 'Select the device board:',
			choices: [
				{ name: 'Tachyon EVT', value: 'formfactor' },
				{ name: 'Tachyon DVT or later', value: 'formfactor_dvt' },
				{ name: 'Qualcomm RB3 Gen 2', value: 'rb3g2' }
			]
		}]);
		return board;
	}

	async _selectWorkflow({ isLocalVersion, version, distroVersion, configFromFile, defaultWorkflow }) {
		const requestedWorkflow = distroVersion ? this._getUbuntuWorkflow(distroVersion) : null;

		// A local image is authoritative because its embedded manifest describes what
		// will actually be flashed. An explicit distro may confirm it, but may not
		// contradict it.
		if (isLocalVersion) {
			const manifest = await readManifestFromLocalFile(version);
			const imageWorkflow = Object.values(workflows).find(wf =>
				wf.osInfo.distribution === manifest.distribution &&
				wf.osInfo.distributionVersion === manifest.distribution_version
			);
			if (!imageWorkflow) {
				throw new Error(
					`The local image uses unsupported distribution '${manifest.distribution} ${manifest.distribution_version}'`
				);
			}
			if (requestedWorkflow && requestedWorkflow !== imageWorkflow) {
				throw new Error(
					`The requested distribution version '${distroVersion}' does not match the local image ` +
					`distribution version '${manifest.distribution_version}'`
				);
			}
			return imageWorkflow;
		}

		// An explicit command-line distro is the user's selection. It takes priority
		// over a loaded configuration and avoids asking the OS selection question.
		if (requestedWorkflow) {
			return requestedWorkflow;
		}
		if (configFromFile?.workflow) {
			return workflows[configFromFile.workflow];
		}

		if (!configFromFile?.silent) {
			return this._pickWorkflowToExecute();
		}
		return defaultWorkflow;
	}

	_getUbuntuWorkflow(distroVersion) {
		const normalizedVersion = String(distroVersion).trim();
		const ubuntuWorkflows = Object.values(workflows).filter(wf => wf.osInfo.distribution === 'ubuntu');
		const workflow = ubuntuWorkflows.find(wf => wf.osInfo.distributionVersion === normalizedVersion);
		if (!workflow) {
			const supportedVersions = ubuntuWorkflows.map(wf => wf.osInfo.distributionVersion).join(', ');
			throw new Error(
				`Unsupported Linux distribution version '${normalizedVersion}'. Supported versions: ${supportedVersions}`
			);
		}
		return workflow;
	}

	async _loadConfigFromFile(loadConfig) {
		if (loadConfig) {
			try {
				const data = fs.readFileSync(loadConfig, 'utf8');
				const config = JSON.parse(data);
				return { ...config, silent: true, loadedFromFile: true };
			} catch (error) {
				throw new VError(error, 'The configuration file is not a valid JSON file');
			}
		}
	}

	async _getManifestBuilds({ version, osInfo, region, board }) {
		const manifestVersion = await this.downloadManager.fetchManifest({ version });
		return manifestVersion.builds.filter(os =>
			os.distribution === osInfo.distribution &&
			os.distribution_version === osInfo.distributionVersion &&
			os.region === region &&
			os.board === board
		);
	}

	async _saveConfig(config) {
		const configFields = [
			'region',
			'board',
			'version',
			'variant',
			'skipCli',
			'systemPassword',
			'productId',
			'timezone',
			'wifi',
			'country',
		];
		const configData = { ...config };

		const savedConfig = Object.fromEntries(
			configFields
				.filter(key => key in configData && configData[key] !== null && configData[key] !== undefined)
				.map(key => [key, configData[key]])
		);
		savedConfig.workflow = config.workflow.value;
		await fs.writeFile(config.saveConfig, JSON.stringify(savedConfig, null, 2), 'utf-8');
		this.ui.write(`${os.EOL}Configuration file written here: ${config.saveConfig}${os.EOL}`);
	}


	_setupApi() {
		const { api } = this._particleApi();
		this.api = api;
	}
};
