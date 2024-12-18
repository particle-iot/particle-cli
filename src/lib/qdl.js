const execa = require('execa');
const utilities = require('../lib/utilities');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const util = require('util');
const temp = require('temp').track();
const mkdirTemp = util.promisify(temp.mkdir);

const TACHYON_STORAGE_TYPE = 'ufs';

async function getExecutable() {
	const archType = utilities.getArchType();
	const archName = utilities.getOs();
	const qdlDir = path.join(__dirname, `../../assets/qdl/${archName}/${archType}`);
	if (!await fs.pathExists(qdlDir)) {
		throw new Error('Flashing Tachyon is not suppported on your OS');
	}

	// Copy qdl to a temporary directory, so it can run outside the pkg snapshot
	const tmpDir = await mkdirTemp('qdl');
	await fs.copy(qdlDir, tmpDir);

	return path.join(tmpDir, 'qdl' + (archName === 'win32' ? '.exe' : ''));
}

/**
 */
async function run({ files, includeDir, updateFolder, zip, verbose, ui }) {
	const qdl = await getExecutable();

	const qdlArgs = [
		'--storage',
		TACHYON_STORAGE_TYPE,
		...(zip ? ['--zip', zip] : []),
		...(includeDir ? ['--include', includeDir] : []),
		...files
	];

	if (verbose) {
		ui.write(`Command: ${qdl} ${qdlArgs.join(' ')}${os.EOL}`);
	}

	const res = await execa(qdl, qdlArgs, {
		cwd: updateFolder || process.cwd(),
		stdio: verbose ? 'inherit' : 'pipe'
	});

	return res;
}

module.exports = {
	run
};
