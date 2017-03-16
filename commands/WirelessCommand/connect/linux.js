var spawn = require('child_process').spawn;
var wifiCli = '/usr/bin/nmcli';

var runCommand = require('./executor').runCommand;

function getCurrentNetwork(cb) {
	var currentNetworkParams = "--terse --fields NAME,TYPE connection show --active";

	runCommand(wifiCli, currentNetworkParams, function (err, code, stdout, stderr) {
		if(err || stderr || code) {
			return cb(err || stderr || code);
		}

		var wifiType = "802-11-wireless";
		var lines = stdout.split('\n');
		for(var i = 0; i < lines.length; i++) {
			var fields = lines[i].split(":");
			var ssid = fields[0];
			var type = fields[1];
			if(type === wifiType) {
				return cb(null, ssid);
			}
		}

		cb();
	});
}

function connect(opts, cb) {
	function reconnect() {
		var connectionDoesNotExistError = 10;
		var reconnectParams = 'connection up id ' + opts.ssid;
		runCommand(wifiCli, reconnectParams, function (err, code, stdout, stderr) {
			if(code == connectionDoesNotExistError) {
				return newConnect();
			} else if(err || stderr) {
				return cb(err || stderr);
			}

			cb(null, opts);
		});
	}

	function newConnect() {
		var newConnectParams = 'device wifi connect ' + opts.ssid;
		if(opts.password) {
			newConnectParams += ' password ' + opts.password;
		}

		runCommand(wifiCli, newConnectParams, function (err, code, stdout, stderr) {
			if(err || stderr || code) {
				return cb(err || stderr || code);
			}

			cb(null, opts);
		});
	}

	reconnect();
}

module.exports = {
	connect: connect,
	getCurrentNetwork: getCurrentNetwork
};
