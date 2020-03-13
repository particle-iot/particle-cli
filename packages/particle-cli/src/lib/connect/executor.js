const spawn = require('child_process').spawn;
const extend = require('xtend');


module.exports.systemExecutor = (cmdArgs) => {
	const { runCommand } = module.exports;

	return new Promise((resolve, reject) => {
		runCommand(cmdArgs[0], cmdArgs.splice(1), (err, code, stdout, stderr) => {
			if (err || stderr || code){
				reject({ err, stderr, stdout, code });
			} else {
				resolve(stdout);
			}
		});
	});
};

/***
 * Executes a command, collecting the output from stdout and stderr.
 * @param cmd
 * @param args
 * @param cb callback that receives (error, exitCode, stdout, stderr)
 */
module.exports.runCommand = (cmd, args, cb) => {
	// set locale so we can be sure of consistency of command execution
	const env = extend(process.env, { LANG: 'en', LC_ALL: 'en', LC_MESSAGES: 'en' });

	const argArray = Array.isArray(args) ? args : args.split(' ');

	const s = spawn(cmd, argArray, {
		stdio: ['ignore', 'pipe', 'pipe'],
		env
	});

	let stdout = '';
	s.stdout.on('data', (data) => {
		stdout += data;
	});

	let stderr = '';
	s.stderr.on('data', (data) => {
		stderr += data;
	});

	s.on('error', (error) => {
		cb(error, null, stdout, stderr);
	});

	s.on('close', (code) => {
		cb(null, code, stdout, stderr);
	});
};

