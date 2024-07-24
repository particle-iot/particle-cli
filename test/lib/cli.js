const path = require('path');
const execa = require('execa');
const { delay } = require('./mocha-utils');
const {
	USERNAME,
	PASSWORD,
	DEVICE_ID,
	DEVICE_NAME,
	FOREIGN_USERNAME,
	FOREIGN_PASSWORD,
	PATH_TMP_DIR,
	PATH_PROJ_BLANK_INO,
	PATH_PROJ_STROBY_INO,
	PATH_FIXTURES_PKG_DIR
} = require('./env');
const cliBinPath = path.join(PATH_FIXTURES_PKG_DIR, 'node_modules', '.bin', 'particle');

module.exports.run = (args = [], options = {}) => {
	const opts = Object.assign({
		cwd: PATH_TMP_DIR,
		reject: false,
		all: true
	}, options);

	args = Array.isArray(args) ? args : [args];
	return execa(cliBinPath, [...args], opts);
};

module.exports.runWithRetry = async (args = [], options = {}, { attempts = 3 } = {}) => {
	const { run, runWithRetry } = module.exports;

	try {
		return await run(args, options);
	} catch (error){
		if (attempts <= 0){
			throw error;
		}
		await delay(500);
		return runWithRetry(args, options, { attempts: attempts - 1 });
	}
};

module.exports.debug = (...args) => {
	const subprocess = module.exports.run(...args);
	subprocess.stdout.pipe(process.stdout);
	subprocess.stderr.pipe(process.stderr);
	return subprocess;
};

module.exports.login = () => {
	const { run } = module.exports;
	return run(['login', '-u', USERNAME, '-p', PASSWORD], { reject: true });
};

module.exports.loginToForeignAcct = async () => {
	const { run } = module.exports;
	await run(['login', '-u', FOREIGN_USERNAME, '-p', FOREIGN_PASSWORD], { reject: true });
	const s = await run(['whoami'], { reject: true });
	console.log('Logged in as:', s);
};

module.exports.logout = () => {
	const { run } = module.exports;
	return run(['logout'], { input: 'y\n', reject: true });
};

module.exports.setProfile = (name) => {
	const { run } = module.exports;
	return run(['config', name], { reject: true });
};

module.exports.setDefaultProfile = () => {
	const { setProfile } = module.exports;
	return setProfile('particle');
};

module.exports.setTestProfile = () => {
	const { setProfile } = module.exports;
	return setProfile('e2e');
};

module.exports.setTestProfileAndLogin = async () => {
	const { login, logout, setTestProfile } = module.exports;
	await logout();
	await setTestProfile();
	await login();
};

module.exports.claimTestDevice = () => {
	const { run } = module.exports;
	return run(['cloud', 'claim', DEVICE_ID], { reject: true });
};

module.exports.revertDeviceName = () => {
	const { run } = module.exports;
	return run(['device', 'rename', DEVICE_ID, DEVICE_NAME], { reject: true });
};

module.exports.startListeningMode = () => {
	const { run } = module.exports;
	return run(['usb', 'start-listening', DEVICE_ID], { reject: true });
};

module.exports.stopListeningMode = () => {
	const { run } = module.exports;
	return run(['usb', 'stop-listening', DEVICE_ID], { reject: true });
};

module.exports.enterDFUMode = async () => {
	const { run } = module.exports;
	return run(['usb', 'dfu', DEVICE_ID], { reject: true });
};

module.exports.resetDevice = async () => {
	const { run } = module.exports;
	await run(['usb', 'reset', DEVICE_ID], { reject: true });
};

module.exports.compileBlankFirmwareForTest = async (platform = 'photon') => {
	const { run } = module.exports;
	const destination = path.join(PATH_TMP_DIR, `blank-${platform}.bin`);
	await run(['compile', platform, PATH_PROJ_BLANK_INO, '--saveTo', destination]);
	return { bin: destination };
};

module.exports.flashTestFirmwareOTA = (pathToIno) => {
	const { run } = module.exports;
	return run(['flash', DEVICE_NAME, pathToIno], { reject: true });
};

module.exports.flashTestFirmwareOTAWithConfirmation = async (pathToIno, variable) => {
	const { flashTestFirmwareOTA, waitForVariable } = module.exports;
	const { name, value } = variable;

	await flashTestFirmwareOTA(pathToIno);
	// TODO (mirande): use 'spark/status' (online) event when Device Service
	// has full support for it: https://docs.particle.io/reference/device-cloud/api/#special-device-events
	await waitForVariable(name, value);
};

module.exports.flashBlankFirmwareOTAForTest = async () => {
	const { flashTestFirmwareOTAWithConfirmation } = module.exports;
	const variable = { name: 'name', value: 'blank' };
	await flashTestFirmwareOTAWithConfirmation(PATH_PROJ_BLANK_INO, variable);
};

module.exports.flashStrobyFirmwareOTAForTest = async () => {
	const { flashTestFirmwareOTAWithConfirmation } = module.exports;
	const variable = { name: 'name', value: 'stroby' };
	await flashTestFirmwareOTAWithConfirmation(PATH_PROJ_STROBY_INO, variable);
};

module.exports.callStrobyStart = async (deviceID, productID) => {
	const { runWithRetry } = module.exports;
	const args = ['call', deviceID, 'start'];

	if (productID){
		args.push('--product', productID);
	}
	return runWithRetry(args, { reject: true });
};

module.exports.callStrobyStop = async (deviceID, productID) => {
	const { runWithRetry } = module.exports;
	const args = ['call', deviceID, 'stop'];

	if (productID){
		args.push('--product', productID);
	}
	return runWithRetry(args, { reject: true });
};

module.exports.getNameVariable = async () => {
	const { run } = module.exports;
	const { stdout } = await run(['get', DEVICE_NAME, 'name'], { reject: true });
	return stdout;
};

module.exports.getCloudConnectionStatus = async () => {
	const { run } = module.exports;
	const args = ['usb', 'cloud-status', DEVICE_ID];
	return run(args, { reject: true });
};

module.exports.waitUntilOnline = async () => {
	const { run } = module.exports;
	const args = ['usb', 'cloud-status', DEVICE_ID, '--until', 'connected', '--timeout', 5 * 60 * 1000];
	return run(args, { reject: true });
};

module.exports.waitForVariable = async (name, value) => {
	const { waitForResult } = module.exports;
	const args = ['monitor', DEVICE_NAME, name, '--delay', 500];
	const isFinished = (data) => data.toString('utf8').trim() === value;
	return delay(2000).then(() => waitForResult(args, isFinished));
};

module.exports.waitForResult = async (args = [], options = {}, isFinished) => {
	const { run } = module.exports;

	if (typeof options === 'function'){
		isFinished = options;
		options = {};
	}

	return new Promise((resolve, reject) => {
		const subprocess = run(args, options);

		subprocess.all.on('data', (data) => {
			if (isFinished(data)){
				subprocess.cancel();
				resolve(subprocess);
			}
		});
		subprocess.all.on('error', (error) => {
			subprocess.cancel();
			reject(error);
		});
		subprocess.all.on('close', () => {
			subprocess.cancel();
			resolve(subprocess);
		});
	});
};

