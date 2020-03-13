const runCommand = require('./executor').runCommand;

function getFirstWifiPort(cb) {
	runCommand('networksetup', '-listnetworkserviceorder', (err, code, stdout, stderr) => {
		if (err || stderr || code) {
			return cb(err || stderr || code);
		}
		let device;
		let useNextDevice = false;
		const lines = stdout.split('\n');
		for (let i=0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) {
				continue;
			}

			if (useNextDevice) {
				const searchString = 'Device: ';
				const idx = line.indexOf(searchString);
				if (idx > 0) {
					const lastIndex = line.lastIndexOf(')');
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
	getFirstWifiPort((err, device) => {
		if (err) {
			return cb(err);
		}

		if (!device) {
			return cb(new Error('Unable to find a Wi-Fi network interface'));
		}

		runCommand('networksetup', '-getairportnetwork ' + device, (err, code, stdout, stderr) => {
			if (err || stderr || code) {
				return cb(err || stderr || code);
			}

			const lines = stdout.split('\n');
			const currentString = 'Current Wi-Fi Network: ';
			if (lines.length && lines[0].indexOf(currentString) === 0) {
				const network = lines[0].slice(currentString.length).trim();
				return cb(null, network);
			}

			return cb();
		});
	});
}

function connect(opts, cb) {
	getFirstWifiPort((err, device) => {
		if (err) {
			return cb(err);
		}

		if (!device) {
			return cb(new Error('Unable to find a Wi-Fi network interface'));
		}

		let params = '-setairportnetwork ' + device + ' ' + opts.ssid;
		if (opts.password) {
			params += ' ' + opts.password;
		}

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
