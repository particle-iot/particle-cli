var spawn = require('child_process').spawn;

function runCommand(cmd, args, cb) {
	var argArray = args.split(' ');

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

	s.on('close', function (code) {
		cb(code, stdout, stderr);
	});
}


function getFirstWifiPort(cb) {
	runCommand('networksetup', '-listnetworkserviceorder', function (err, stdout, stderr) {
		if (err || stderr) {
			return cb(err || stderr);
		}
		var device;
		var useNextDevice = false;
		var lines = stdout.split('\n');
		for (var i=0; i < lines.length; i++) {
			var line = lines[i];
			if (!line) {
				continue;
			}

			if (useNextDevice) {
				var searchString = 'Device: ';
				var idx = line.indexOf(searchString);
				if (idx > 0) {
					var lastIndex = line.lastIndexOf(')');
					device = line.slice(idx + searchString.length, lastIndex).trim();
					break;
				} else {
					return cb(new Error('Unable to parse output of networksetup -listnetworkserviceorder'));
				}
			} else if (line.indexOf('Wi-Fi') > 0) {
				useNextDevice = true;
				continue;
			}
		}

		return cb(null, device);
	});
}

function getCurrentNetwork(cb) {
	getFirstWifiPort(function (err, device) {
		if (err) {
			return cb(err);
		}

		if (!device) {
			return cb(new Error('Unable to find a Wi-Fi network interface'));
		}

		runCommand('networksetup', '-getairportnetwork ' + device, function (err, stdout, stderr) {
			if (err || stderr) {
				return cb(err || stderr);
			}

			var lines = stdout.split('\n');
			var currentString = 'Current Wi-Fi Network: ';
			if (lines.length && lines[0].indexOf(currentString) === 0) {
				var network = lines[0].slice(currentString.length).trim();
				return cb(null, network);
			}

			return cb();
		});
	});
}

function connect(opts, cb) {
	getFirstWifiPort(function (err, device) {
		if (err) {
			return cb(err);
		}

		if (!device) {
			return cb(new Error('Unable to find a Wi-Fi network interface'));
		}

		var params = '-setairportnetwork ' + device + ' ' + opts.ssid;
		if (opts.password) { params += ' ' + opts.password; }

		// TODO: something with opts & interfaces?
		runCommand('networksetup', params, function results(err, stdout, stderr) {
			if (err || stderr) {
				// TODO: more research into failure modes of this command
				return cb(err || stderr);
			}
			cb(null, opts);
		});
	});
};

module.exports = {
	connect: connect,
	getCurrentNetwork: getCurrentNetwork
};
