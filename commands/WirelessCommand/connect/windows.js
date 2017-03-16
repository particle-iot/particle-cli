
var extend = require('xtend');
var runCommand = require('./executor').runCommand;
var when = require('when');

function systemExecutor(cmdArgs) {

	var dfd = when.defer();

	runCommand(cmdArgs[0], cmdArgs.splice(1), function handler(err, code, stdout, stderr) {
		var fail = err || stderr || code;
		if (fail) {
			dfd.reject(fail);
		}
		else {
			dfd.resolve(stdout);
		}
	});

	return dfd.promise;
}

/**
 * @param commandExecutor   A function that returns a promise to execute a given command.
 * @constructor
 */
function Connect(commandExecutor) {
	this.commandExecutor = commandExecutor || systemExecutor;
}

Connect.prototype = extend(Object.prototype, {

	_execWiFiCommand(cmdArgs) {
		return this._exec(['netsh', 'wlan'].concat(cmdArgs));
	},

	_exec(cmdArgs) {
		return this.commandExecutor(cmdArgs);
	},

	current() {
		return this.currentInterface()
		.then(function(iface) {
			return iface ? iface.profile : undefined;
		});
	},

	/**
	 * Determine the current network interface
	 * @return Promise.<String> the current network interface object
	 */
	currentInterface() {
		var self = this;
		return this._execWiFiCommand(['show', 'interfaces'])
		.then(function(output) {
			var lines = self._stringToLines(output);
			var iface = self._currentFromInterfaces(lines);
			if (iface && !iface['profile']) {
				iface = null;
			}
			return iface;
		});
	},

	/**
	 * Extracts the current interface from the list of interfaces.
	 * @param output
	 * @private
	 */
	_currentFromInterfaces(lines) {
		var idx = 0;
		var iface;
		while (idx < lines.length && (!iface || !iface['profile'])) {
			var data = this._extractInterface(lines, idx);
			iface = data.iface;
			idx = data.range.end;
		}
		return iface;
	},

	/**
	 * Reads all the lines of info up until the end, or the next 'name', collecting the property keys and values into
	 * an object keyed by 'iface'. a `range` property provides `start` and `end` for the indices of the range.
	 * The end index is exclusive.
	 * @param lines
	 * @param index
	 * @private
	 */
	_extractInterface(lines, index) {
		index = index || 0;
		var result = { iface: {}, range: {} };
		var name = 'name';
		var kv;
		for (;index<lines.length;index++) {
			kv = this._keyValue(lines[index]);
			if (kv && kv.key===name) {
				// we have the start
				result.iface[kv.key] = kv.value;
				break;
			}
		}

		result.range.start = index++;

		for (;index<lines.length;index++) {
			kv = this._keyValue(lines[index]);
			if (!kv)
				continue;

			if (kv.key===name) {
				// we have the end
				break;
			}

			if (kv.key && kv.value) {
				result.iface[kv.key] = kv.value;
			}
		}
		result.range.end = index;
		return result;
	},

	/**
	 * Extract a key and value from a string like ':'
	 * @param line
	 * @private
	 */
	_keyValue(line) {
		var colonIndex = line.indexOf(':');
		var result;
		if (colonIndex>0) {
			var key = line.slice(0, colonIndex).trim().toLowerCase();
			var value = line.slice(colonIndex+1).trim();
			result = { key: key, value: value };
		}
		return result;
	},

	_stringToLines(s) {
		return s.match(/[^\r\n]+/g);
	}
});


function asCallback(promise, cb) {
	return promise.then(function success(arg) {
		cb(null, arg);
	}).catch(function fail(error) {
		cb(error);
	});
}

function getCurrentNetwork(cb) {
	asCallback(new Connect().current(), cb);
}

/**
 *
 * @param opts
 *  - ssid property is the SSID of the network to connect to.
 *  - profileName is the name of the network profile to connect to. Defaults to ssid if not defined.
 * @param cb
 */
function connect(opts, cb) {
	asCallback(new Connect().connect(opts), cb);
}

module.exports = {
	connect: connect,
	getCurrentNetwork: getCurrentNetwork,
	asCallback: asCallback,
	Connector: Connect
};
