var exec = require('child_process').exec;
function darwin(opts, cb) {

	exec('networksetup -listnetworkserviceorder', function (err, stdout, stderr) {
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

		if (!device) {
			return cb(new Error('Unable to find a Wi-Fi network interface'));
		}

		var params = 'networksetup -setairportnetwork ' + device + ' ' + opts.ssid;
		if (opts.password) { params += ' ' + opts.password; }

		// TODO: something with opts & interfaces?
		exec(params, function results(err, stdout, stderr) {
			if (err || stderr) {
				// TODO: more research into failure modes of this command
				return cb(err || stderr);
			}
			cb(null, opts);
		});
	});
};

module.exports = darwin;
