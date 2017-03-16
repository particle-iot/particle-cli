var spawn = require('child_process').spawn;
var runCommand = require('./executor').runCommand;

function getFirstWifiPort(cb) {
	runCommand('networksetup', '-listnetworkserviceorder', function (err, code, stdout, stderr) {
		if (err || stderr || code) {
			return cb(err || stderr || code);
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

		runCommand('networksetup', '-getairportnetwork ' + device, function (err, code, stdout, stderr) {
			if (err || stderr || code) {
				return cb(err || stderr || code);
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
		runCommand('networksetup', params, function results(err, code, stdout, stderr) {
			if (err || stderr || code) {
				// TODO: more research into failure modes of this command
				return cb(err || stderr || code);
			}
			cb(null, opts);
		});
	});
}

module.exports = {
	connect: connect,
	getCurrentNetwork: getCurrentNetwork
};
