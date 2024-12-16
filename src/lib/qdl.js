const execa = require('execa');
const utilities = require('../lib/utilities');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

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
async function run({ files, updateFolder, verbose, ui }) {
	const qdl = await getExecutable();

	ui.write(`Command: ${qdl} --storage ${TACHYON_STORAGE_TYPE} ${files.join(' ')}${os.EOL}`);

	const res = await execa(qdl, ['--storage', 'ufs', ...files], {
		cwd: updateFolder,
		stdio: verbose ? 'inherit' : 'pipe'
	});

	return res;
}

module.exports = {
	run
};
