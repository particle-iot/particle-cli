const execa = require('execa');
const utilities = require('../lib/utilities');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { update } = require('lodash');

const TACHYON_STORAGE_TYPE = 'ufs';

async function getExecutable() {
	const archType = utilities.getArchType();
	const archName = utilities.getOs();
	const qdlExec = path.join(__dirname, `../../assets/qdl/${archName}/${archType}/qdl`);
	await fs.ensureFile(qdlExec);
	await fs.chmod(qdlExec, 0o755);
	return qdlExec;
}

/**
 */
async function run({ files, updateFolder, zip, verbose, ui }) {
	const qdl = await getExecutable();

	if (zip) {
		// remove the first / from the update folder and all the files
		updateFolder = updateFolder.replace(/^\//, '');
		files = files.map((file) => file.replace(/^\//, ''));
	}

	const qdlArgs = [
		'--storage', 
		TACHYON_STORAGE_TYPE,
		...(zip ? ['--zip', zip] : []),
		'--include',
		updateFolder,
		...files
	];

	ui.write(`Command: ${qdl} ${qdlArgs.join(' ')}`);

	const res = await execa(qdl, qdlArgs, {
		cwd: updateFolder,
		stdio: verbose ? 'inherit' : 'pipe'
	});

	return res;
}

module.exports = {
	run
};
