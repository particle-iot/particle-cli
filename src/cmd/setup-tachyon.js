const CLICommandBase = require('./base');
const spinnerMixin = require('../lib/spinner-mixin');
const fs = require('fs-extra');
const ParticleApi = require('./api');
const settings = require('../../settings');
const createApiCache = require('../lib/api-cache');
const ApiClient = require('../lib/api-client');
const os = require('os');
const CloudCommand = require('./cloud');

const DownloadManager = require('../lib/download-manager');
const path = require('path');
const { getTachyonInfo, getEDLDevice, handleFlashError, promptOSSelection, isFile, readManifestFromLocalFile
} = require('../lib/tachyon-utils');
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
		this.defaultOptions = {
			region: 'NA',
			version: settings.tachyonVersion || 'stable',
			board: 'formfactor_dvt',
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
		await this.ui.write(showWelcomeMessage(this.ui));
		// step 1 login
		this._formatAndDisplaySteps("Okay—first up! Checking if you're logged in...");
		await this._verifyLogin();
		this.ui.write('');
		this.ui.write(`...All set! You're logged in as ${this.ui.chalk.bold(settings.username)} and ready to go!`);
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
		const deviceInfo = await this._getDeviceInfo();
		deviceInfo.usbVersion = this.device.usbVersion.major;
		this._printDeviceInfo(deviceInfo);
		// check if there is a config file
		// validate version if local then workflow will be inferred from the manifest
		const isLocalVersion = version ? await isFile(version) : false;
		const config = await this._loadConfig({ options, deviceInfo, isLocalVersion });

		const context = {
			...config,
			ui: this.ui,
			api: this.api,
			deviceInfo: deviceInfo,
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
	}

	async _getDeviceInfo() {
		try {
			return await this.ui.showBusySpinnerUntilResolved('Getting device info', getTachyonInfo({
				outputLog: this.outputLog,
				ui: this.ui,
				device: this.device
			}));
		} catch (error) {
			// If this fails, the flash won't work so abort early.
			const { retry } = await handleFlashError({ error, ui: this.ui });
			if (retry) {
				return this._getDeviceInfo();
			}
			throw new Error('Unable to get device info. Please restart the device and try again.');
		}
	}

	async _printDeviceInfo(deviceInfo) {
		this.ui.write(this.ui.chalk.bold('Device info:'));
		this.ui.write(os.EOL);
		this.ui.write(` -  Device ID: ${deviceInfo.deviceId}`);
		if (deviceInfo.board === 'formfactor') {
			this.ui.write(' -  Board: EVT');
		}
		this.ui.write(` -  Region: ${deviceInfo.region}`);
		this.ui.write(` -  OS Version: ${deviceInfo.osVersion}`);
		let usbWarning = '';
		if (this.device.usbVersion.major <= 2) {
			usbWarning = this.ui.chalk.yellow(' (use a USB 3.0 port and USB-C cable for faster flashing)');
		}
		this.ui.write(` -  USB Version: ${this.device.usbVersion.major}.${this.device.usbVersion.minor}${usbWarning}`);
	}

	async _verifyLogin() {
		const api = new ApiClient();
		try {
			api.ensureToken();
			const currentToken = await api.getCurrentToken();
			const minRemainingTime = 60 * 60 * 1000; // 1 hour
			const expiresAt = currentToken.expires_at ? new Date(currentToken.expires_at) : null;
			if (expiresAt !== null && (expiresAt - Date.now()) < minRemainingTime) {
				throw new Error('Token expired or near to expire');
			}
		} catch {
			const cloudCommand = new CloudCommand();
			await cloudCommand.login();
			this._setupApi();
		}
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
	async _loadConfig({ options, deviceInfo, isLocalVersion }) {
		let selectedWorkflow;
		const configFromFile = await this._loadConfigFromFile(options.loadConfig);
		const optionsFromDevice = {};

		selectedWorkflow = await this._selectWorkflow({
			isLocalVersion,
			version: options.version,
			configFromFile,
			defaultWorkflow: this.defaultOptions.workflow
		});

		const cleanedOptions = Object.fromEntries(
			// eslint-disable-next-line no-unused-vars
			Object.entries(options).filter(([_, v]) => v !== undefined)
		);
		if (deviceInfo) {
			optionsFromDevice.region = deviceInfo.region.toLowerCase() !== 'unknown' ? deviceInfo.region : 'NA';
			optionsFromDevice.board = deviceInfo.board;
		}

		const config = {
			...this.defaultOptions,
			...selectedWorkflow?.overrideDefaults,
			...optionsFromDevice,
			...configFromFile,
			...cleanedOptions,
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

	async _selectWorkflow({ isLocalVersion, version, configFromFile, defaultWorkflow }) {
		if (isLocalVersion) {
			const manifest = await readManifestFromLocalFile(version);
			return Object.values(workflows).find(wf =>
				wf.osInfo.distribution === manifest.distribution &&
				wf.osInfo.distributionVersion === manifest.distribution_version
			);
		}
		if (configFromFile?.workflow) {
			return workflows[configFromFile.workflow];
		}

		if (!configFromFile?.silent) {
			return this._pickWorkflowToExecute();
		}
		return defaultWorkflow;
	}

	async _loadConfigFromFile(loadConfig) {
		if (loadConfig) {
			try {
				const data = fs.readFileSync(loadConfig, 'utf8');
				const config = JSON.parse(data);
				// remove board to prevent overwriting.
				delete config.board;
				return { ...config, silent: true, loadedFromFile: true };
			} catch (error) {
				throw new Error(`The configuration file is not a valid JSON file: ${error.message}`);
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

	_particleApi() {
		const auth = settings.access_token;
		const api = new ParticleApi(settings.apiUrl, { accessToken: auth } );
		const apiCache = createApiCache(api);
		return { api: apiCache, auth };
	}

	_setupApi() {
		const { api } = this._particleApi();
		this.api = api;
	}
};
