const execa = require('execa');
const {
	PATH_REPO_DIR
} = require('./env');


module.exports.run = (args = [], options = {}) => {
	const opts = Object.assign({
		cwd: PATH_REPO_DIR,
		reject: false
	}, options);

	args = Array.isArray(args) ? args : [args];
	return execa('dfu-util', [...args], opts);
};

module.exports.debug = (...args) => {
	const subprocess = module.exports.run(...args);
	subprocess.stdout.pipe(process.stdout);
	subprocess.stderr.pipe(process.stderr);
	return subprocess;
};

module.exports.exists = async () => {
	const { version } = module.exports;

	try {
		await version();
	} catch (error){
		return !error; /* false */
	}
	return true;
};

module.exports.ensureExists = async () => {
	const { exists } = module.exports;

	if (!await exists()){
		throw new DFUUtilError('Unable to locate `dfu-util` - please ensure it is installed and working');
	}
};

module.exports.version = () => {
	const { run } = module.exports;
	return run(['--version'], { reject: true });
};


// ERRORS /////////////////////////////////////////////////////////////////////
class DFUUtilError extends Error {
	constructor(message){
		super(message);
		Error.captureStackTrace(this, DFUUtilError);
	}
}

