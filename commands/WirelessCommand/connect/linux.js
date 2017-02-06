var spawn = require('child_process').spawn;
var wifiCli = '/usr/bin/nmcli';

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

	s.on('error', function (error) {
		cb(error, stdout, stderr);
	});

	s.on('close', function (code) {
		cb(code, stdout, stderr);
	});
}

function getCurrentNetwork(cb) {
	var currentNetworkParams = "--terse --fields NAME,TYPE connection show --active";

	runCommand(wifiCli, currentNetworkParams, function (err, stdout, stderr) {
		if(err || stderr) {
			return cb(err || stderr);
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
		runCommand(wifiCli, reconnectParams, function (err, stdout, stderr) {
			if(err == connectionDoesNotExistError) {
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

		runCommand(wifiCli, newConnectParams, function (err, stdout, stderr) {
			if(err || stderr) {
				return cb(err || stderr);
			}

			cb(null, opts);
		});
	}

	reconnect();
};

module.exports = {
	connect: connect,
	getCurrentNetwork: getCurrentNetwork
};
