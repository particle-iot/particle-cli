const os = require('os');
const steps = require('./steps');
/**
 * @typedef {Object} Workflow
 * @property {string} name
 * @property {string} value
 * @property {Object} [overrideDefaults] - In case some defaults needs to be overridden
 * @property {Object} osInfo - Data required to filter out the OS from manifest
 * @property {string} [selectionWarning] - Warning to show after the user selects this workflow.
 * @property {{ name: string, value: string }[]} variants - Accepted variants to choose
 * @property {ReadonlyArray<Step>} steps
 */

/**
 * Minimal logger interface that writes JSON lines.
 * @typedef {Object} Logger
 * @property {(msg: string, extra?: LogExtra) => void} info   Write an info entry.
 * @property {(msg: string, extra?: LogExtra) => void} error  Write an error entry.
 * @property {() => Promise<void>} close                      Flush and close the file.
 */

/**
 * Setup options used by the workflow runner.
 * @typedef {Object} SetupOptions
 * @property {('NA'|'RoW'|string)} region - Target region. Default: `'NA'`.
 * @property {string} version - Tachyon version or channel. Default: `settings.tachyonVersion || 'stable'`.
 * @property {string} board - Hardware/board identifier (e.g., `'formfactor_dvt'`). Default: `'formfactor_dvt'`.
 * @property {string} distroVersion - Distro version (e.g., `'20.04'`). Default: `'20.04'`.
 * @property {string} country - Country/locale code (e.g., `'USA'`). Default: `'USA'`.
 * @property {string|null} variant - Optional SKU/variant; `null` if not applicable. Default: `null`.
 * @property {boolean} skipFlashingOs - If `true`, do not flash the OS. Default: `false`.
 * @property {boolean} skipCli - If `true`, skip CLI install/config steps. Default: `false`.
 * @property {string} timezone - IANA timezone (e.g., `'America/Mexico_City'`). Default: from `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 * @property {boolean} alwaysCleanCache - If `true`, wipe local caches before running. Default: `false`.
 */
/**
 * @typedef Config
 * @property {Object} deviceInfo - device info from identify
 * @property {Object} selectedOS - information of OS to be installed
 * @property {SetupOptions} options
 * @property {boolean} silent - indicates if the workflow will run on silent mode
 * @property {Object} state - indicates logs from every step
 */

/**
 * @typedef {Object} Context
 * @property {{ write:(msg:string)=>void }} ui
 * @property {Workflow} workflow
 * @property {Logger} log
 * @property {Config} config
 * @property {Object} state
 */

/**
 * A single step in the workflow.
 * @callback Step
 * @param {Context} ctx
 * @returns {Promise<void>|void}
 */

/** @type {Workflow} */
const ubuntu20 = Object.freeze({
	name: 'Ubuntu 20.04 (stable), recommended',
	value: 'ubuntu20',
	osInfo: {
		distributionDisplay: 'Ubuntu 20.04',
		distribution: 'ubuntu',
		distributionVersion: '20.04',
		distributionVariant: 'ubuntu'
	},
	variants: [
		{
			name: 'Desktop (GUI)',
			value: 'desktop',
			setupCompletedMessage: 'All done! Your Tachyon device is ready to boot' +
				`to the desktop and will automatically connect to Wi-Fi.${os.EOL}${os.EOL}` +
				`To continue:${os.EOL}` +
				`  - Disconnect the USB-C cable${os.EOL}` +
				`  - Connect a USB-C Hub with an HDMI monitor, keyboard, and mouse.${os.EOL}` +
				`  - Power off the device by holding the power button for 3 seconds and releasing.${os.EOL}` +
				`  - Power on the device by pressing the power button.${os.EOL}${os.EOL}` +
				`When the device boots it will:${os.EOL}` +
				`  - Activate the built-in 5G modem.${os.EOL}` +
				`  - Connect to the Particle Cloud.${os.EOL}` +
				`  - Run all system services, including the desktop if an HDMI monitor is connected.${os.EOL}${os.EOL}`
		},
		{
			name: 'Headless (command-line only)',
			value: 'headless',
			setupCompletedMessage: 'All done! Your Tachyon device is now booting' +
				`into the operating system and will automatically connect to Wi-Fi.${os.EOL}${os.EOL}` +
				`It will also:${os.EOL}` +
				`  - Activate the built-in 5G modem${os.EOL}` +
				`  - Connect to the Particle Cloud${os.EOL}` +
				`  - Run all system services, including battery charging${os.EOL}${os.EOL}`
		},
	],
	steps: Object.freeze([
		steps.pickVariant,
		steps.getUserConfigurationStep,
		steps.configureProductStep,
		steps.getCountryStep,
		steps.downloadOS,
		steps.printOSInfo,
		steps.registerDeviceStep,
		steps.getESIMProfilesStep,
		steps.createConfigBlobStep,
		steps.flashOSAndConfigStep,
		steps.setupCompletedStep
	])
});

/** @type {Workflow} */
const ubuntu24 = Object.freeze({
	name: 'Ubuntu 24.04 (beta)',
	value: 'ubuntu24',
	selectionWarning: 'Heads-up: Development of Ubuntu 24.04 (beta) is still in progress. Some features may be ' +
		`unstable or missing.${os.EOL}` +
		`See https://developer.particle.io/tachyon/software/ubuntu_24_04/overview for more information.${os.EOL}`,
	osInfo: {
		distributionDisplay: 'Ubuntu 24.04',
		distribution: 'ubuntu',
		distributionVersion: '24.04',
		distributionVariant: 'ubuntu'
	},
	overrideDefaults:{
		version: 'latest',
	},
	variants: [
		{
			name: 'Desktop (GUI)',
			value: 'desktop',
			setupCompletedMessage: 'All done! Your Tachyon device is ready to boot to the desktop ' +
				`and will automatically connect to Wi-Fi.${os.EOL}${os.EOL}` +
				`To continue:${os.EOL}` +
				`  - Disconnect the USB-C cable${os.EOL}` +
				`  - Connect a USB-C Hub with an HDMI monitor, keyboard, and mouse.${os.EOL}` +
				`  - Power off the device by holding the power button for 3 seconds and releasing.${os.EOL}` +
				`  - Power on the device by pressing the power button.${os.EOL}${os.EOL}` +
				`When the device boots it will:${os.EOL}` +
				`  - Connect to the Particle Cloud.${os.EOL}`+
				`  - Run all system services, including the desktop if an HDMI monitor is connected.${os.EOL}${os.EOL}` +
				`For more information about what's currently supported on Ubuntu 24.04, visit https://developer.particle.io/tachyon/software/ubuntu_24_04/overview${os.EOL}${os.EOL}`
		},
	],
	steps: Object.freeze([
		steps.pickVariant,
		steps.getUserConfigurationStep,
		steps.configureProductStep,
		steps.downloadOS,
		steps.printOSInfo,
		steps.registerDeviceStep,
		steps.createConfigBlobStep,
		steps.flashOSAndConfigStep,
		steps.setupCompletedStep
	])
});


/** @type {Workflow} */
const android14 = Object.freeze({
	name: 'Android 14 (beta)',
	value: 'android14',
	osInfo: {
		distributionDisplay: 'Android 14',
		distribution: 'android',
		distributionVersion: '14',
	},
	overrideDefaults:{
		version: 'latest',
		variant: 'android'
	},
	variants: [
		{
			name: 'Android UI',
			value: 'android',
			setupCompletedMessage: `All done! Your Tachyon device is ready to boot to Android.${os.EOL}${os.EOL}` +
				`To continue:${os.EOL}` +
				`  - Disconnect the USB-C cable${os.EOL}` +
				`  - Connect a USB-C Hub with an HDMI monitor, keyboard, and mouse.${os.EOL}` +
				`  - Power off the device by holding the power button for 3 seconds and releasing.${os.EOL}` +
				`  - Power on the device by pressing the power button.${os.EOL}${os.EOL}` +
				`After the device boots Android, you can:${os.EOL}` +
				`  - Connect to Wi-Fi and cellular through the Settings app.${os.EOL}` +
				`  - Install additional apps through adb.${os.EOL}` +
				`For more information about what's currently supported on Android 14, visit https://developer.particle.io/tachyon/software/android_14/android-14-overview${os.EOL}${os.EOL}`
		},
	],
	customFlashMessage: `Okay—last step! We're now flashing the device with the operating system${os.EOL}`,
	selectionWarning: `Heads-up: this setup won’t provision the eSIM or connect to the Particle Cloud.${os.EOL}` +
		`If you need to provision the SIM, set up Ubuntu 20.04 first.${os.EOL}` +
		`See https://developer.particle.io/tachyon/software/android_14/android-14-overview for more information.${os.EOL}`,
	steps: Object.freeze([
		steps.pickVariant,
		steps.configureProductStep,
		steps.downloadOS,
		steps.printOSInfo,
		steps.flashOSAndConfigStep,
		steps.setupCompletedStep
	]),
});

/**
 *
 * @param {Workflow} workflow - workflow to run
 * @param {Context} context - information required to every step to run
 * @return {Promise<void>}
 */
async function run(workflow, context) {
	let currentContext = context;
	currentContext.log.info(`[${new Date().toISOString()}] Starting workflow ${workflow.name}`);
	for (const [index, step] of workflow.steps.entries()) {
		try {
			currentContext.log.info(`[${new Date().toISOString()}] Step ${step.name} started`);
			const result = await step(currentContext, index + 1);
			currentContext = { ...currentContext, ...(result ?? {}) };
		} catch (error) {
			currentContext.log.error(`[${new Date().toISOString()}] Error occurred during step: ${step?.name}: ${error.message} `);
			throw error;
		} finally {
			currentContext.log.info(`[${new Date().toISOString()}] Step ${step?.name} completed`);
		}
	}
	currentContext.log.info(`[${new Date().toISOString()}] Finished workflow ${workflow.name}`);
	return currentContext;
}

module.exports = {
	workflows: {
		ubuntu20,
		ubuntu24,
		android14,
	},
	workflowRun: run
};
