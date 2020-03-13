const wifiCli = '/usr/bin/nmcli';

const runCommand = require('./executor').runCommand;

function getCurrentNetwork(cb) {
	const currentNetworkParams = '--terse --fields NAME,TYPE connection show --active';

	runCommand(wifiCli, currentNetworkParams, (err, code, stdout, stderr) => {
		if (err || stderr || code) {
			return cb(err || stderr || code);
		}

		const wifiType = '802-11-wireless';
		const lines = stdout.split('\n');
		for (let i = 0; i < lines.length; i++) {
			const fields = lines[i].split(':');
			const ssid = fields[0];
			const type = fields[1];
			if (type === wifiType) {
				return cb(null, ssid);
			}
		}

		cb();
	});
}

function connect(opts, cb) {
	function reconnect() {
		const connectionDoesNotExistError = 10;
		const reconnectParams = 'connection up id ' + opts.ssid;
		runCommand(wifiCli, reconnectParams, (err, code, stdout, stderr) => {
			if (code === connectionDoesNotExistError) {
				return newConnect();
			} else if (err || stderr) {
				return cb(err || stderr);
			}

			cb(null, opts);
		});
	}

	function newConnect() {
		let newConnectParams = 'device wifi connect ' + opts.ssid;
		if (opts.password) {
			newConnectParams += ' password ' + opts.password;
		}

		runCommand(wifiCli, newConnectParams, (err, code, stdout, stderr) => {
			if (err || stderr || code) {
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
