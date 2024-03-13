const os = require('os');
const path = require('path');
const execa = require('execa');
const cli = require('../lib/cli');
const fs = require('../lib/fs');
const {
	USERNAME,
	PASSWORD,
	DEVICE_ID,
	DEVICE_NAME,
	DEVICE_PLATFORM_ID,
	DEVICE_PLATFORM_NAME,
	PATH_FIXTURES_PKG_DIR,
	PATH_REPO_DIR,
	PATH_HOME_DIR,
	PATH_TMP_DIR
} = require('../lib/env');
const { version } = require('../../package.json');
const NPM_PACKAGE_PATH = path.join(__dirname, '..', '..', `particle-cli-${version}.tgz`);

const builds = {
	'darwin-x64': 'particle-cli',
	'linux-x64': 'particle-cli',
	'win32-x64': 'particle-cli.exe'
};


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
	const particleCliDir = path.join(PATH_FIXTURES_PKG_DIR, 'node_modules', '.bin');
	await Promise.all(
		[PATH_HOME_DIR, PATH_TMP_DIR, particleCliDir]
			.map(dir => fs.ensureDir(dir)
				.then(() => fs.emptyDir(dir)))
	);

	//await execa('npm', ['pack'], { cwd: PATH_REPO_DIR, stdio: 'inherit' });
	//console.log(PATH_REPO_DIR);
	//const script = path.join(PATH_REPO_DIR, 'scripts', 'test-cli-pkg.sh');
	//await execa('bash', [script], { stdio: 'inherit' });
	const osKey = `${os.platform()}-${os.arch()}`;
	const cliName = builds[osKey];
	await execa('cp', [path.join(PATH_REPO_DIR, 'build', cliName), path.join(PATH_FIXTURES_PKG_DIR, 'node_modules', '.bin', 'particle')]);
});

afterEach(async () => {
	await fs.emptyDir(PATH_TMP_DIR);
});

after(async () => {
	await cli.logout();
	await cli.setDefaultProfile();
	await fs.remove(NPM_PACKAGE_PATH);
	await fs.remove(path.join(PATH_FIXTURES_PKG_DIR, 'node_modules'));
});

