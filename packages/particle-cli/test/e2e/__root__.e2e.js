const os = require('os');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	USERNAME,
	PASSWORD,
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_ID,
	DEVICE_PLATFORM_NAME,
	PATH_HOME_DIR,
	PATH_TMP_DIR
} = require('../lib/env');


if (os.userInfo().homedir === os.homedir()){
	throw new Error([
		'\n',
		'::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::',
		':::: Cannot write to default $HOME directory - Please override! ::::',
		':::: See: ./test/lib/.env.js :::::::::::::::::::::::::::::::::::::::',
		'::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::',
		'\n'
	].join('\n'));
}

if (!USERNAME || !PASSWORD || !DEVICE_ID || !DEVICE_NAME || !DEVICE_PLATFORM_ID || !DEVICE_PLATFORM_NAME){
	throw new Error([
		'\n',
		'::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::',
		':::: End-To-End test configuration is missing or invalid! ::::::::::',
		':::: For setup instructions, see: ./test/README.md :::::::::::::::::',
		'::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::',
		'\n'
	].join('\n'));
}

before(async () => {
	await Promise.all(
		[PATH_HOME_DIR, PATH_TMP_DIR]
			.map(dir => fs.ensureDir(dir)
				.then(() => fs.emptyDir(dir)))
	);
});

afterEach(async () => {
	await fs.emptyDir(PATH_TMP_DIR);
});

after(async () => {
	await cli.logout();
	await cli.setDefaultProfile();
});

