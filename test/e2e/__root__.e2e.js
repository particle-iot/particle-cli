const os = require('os');
const cli = require('../__lib__/cli');
const fs = require('../__lib__/fs');
const {
	PATH_HOME_DIR,
	PATH_TMP_DIR
} = require('../__lib__/env');


if (os.userInfo().homedir === os.homedir()){
	throw new Error([
		'\n',
		'::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::',
		':::: Cannot write to default $HOME directory - Please override! ::::',
		':::: See: ./test/__lib__/.env.js :::::::::::::::::::::::::::::::::::',
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

