/***
 * Executes a command, collecting the output from stdout and stderr.
 * @param cmd
 * @param args
 * @param cb callback that receives (error, exitCode, stdout, stderr)
 */
function runCommand(cmd, args, cb) {
	var argArray = Array.isArray(args) ? args : args.split(' ');

	var s = spawn(cmd, argArray, {
		stdio: ['ignore', 'pipe', 'pipe']
	});

	var stdout = '';
	s.stdout.on('data', function (data) {
		stdout += data;
	});

	var stderr = '';
	s.stderr.on('data', function (data) {
		stderr += data;
	});

	s.on('error', function (error) {
		cb(error, null, stdout, stderr);
	});

	s.on('close', function (code) {
		cb(null, code, stdout, stderr);
	});
}

module.exports = {
	runCommand: runCommand
};