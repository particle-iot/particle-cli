const path = require('path');
const execa = require('execa');
const { delay } = require('./mocha-utils');
const {
	USERNAME,
	PASSWORD,
	DEVICE_ID,
	DEVICE_NAME,
	PATH_TMP_DIR,
	PATH_REPO_DIR,
	PATH_PROJ_BLANK_INO,
	PATH_PROJ_STROBY_INO
} = require('./env');
const cliBinPath = path.join(PATH_REPO_DIR, 'dist', 'index.js');


module.exports.run = (args = [], options = {}) => {
	const opts = Object.assign({
		cwd: PATH_REPO_DIR,
		reject: false
	}, options);

	args = Array.isArray(args) ? args : [args];
	return execa(cliBinPath, [...args], opts);
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
	return run(['usb', 'start-listening'], { reject: true });
};

module.exports.stopListeningMode = () => {
	const { run } = module.exports;
	return run(['usb', 'stop-listening'], { reject: true });
};

module.exports.enterDFUMode = async () => {
	const { run } = module.exports;
	await run(['usb', 'dfu'], { reject: true });
	await delay(2000);
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

module.exports.removeDeviceFromMeshNetwork = () => {
	const { run } = module.exports;
	return run(['mesh', 'remove', DEVICE_ID, '--yes'], { reject: true });
};

module.exports.getNameVariable = async () => {
	const { run } = module.exports;
	const { stdout } = await run(['get', DEVICE_NAME, 'name'], { reject: true });
	return stdout;
};

module.exports.waitForVariable = async (name, value) => {
	const { run } = module.exports;
	await delay(2000);
	const subprocess = run(['monitor', DEVICE_NAME, name, '--delay', 500]);
	return new Promise((resolve, reject) => {
		subprocess.all.on('data', (data) => {
			const received = data.toString('utf8');

			if (received.trim() === value){
				subprocess.cancel();
				resolve();
			}
		});
		subprocess.all.on('error', (error) => {
			subprocess.cancel();
			reject(error);
		});
		subprocess.all.on('close', () => {
			subprocess.cancel();
			resolve();
		});
	});
};

