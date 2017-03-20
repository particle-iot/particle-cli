
var extend = require('xtend');
var runCommand = require('./executor').runCommand;
var when = require('when');
var pipeline = require('when/pipeline');
var fs = require('fs');

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

	_execWiFiCommand: function(cmdArgs) {
		return this._exec(['netsh', 'wlan'].concat(cmdArgs));
	},

	_exec: function(cmdArgs) {
		return this.commandExecutor(cmdArgs);
	},

	/**
	 * Retrieves the profile name of the currently connected network.
	 * @returns {Promise.<String>}  The profile name of the currently connected network, or undefined if no connection.
	 */
	current: function() {
		return this.currentInterface()
		.then(function(iface) {
			return iface ? iface.profile : undefined;
		});
	},

	/**
	 * Determine the current network interface.
	 * @return {Promise.<Object>} the current network interface object
	 */
	currentInterface: function() {
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
	 * Connect the wifi interface to the given access point with the named profile.
	 * If the profile already exists, it is used. Otherwise a new profile for an open AP is created.
	 */
	connect: function(profile) {
		var self = this;
		var interfaceName;
		return pipeline([
			this.currentInterface,      		// find the current interface
			this._checkHasInterface,            // fail if no interfaces
			function (ifaceName) {              // save the interface name
				interfaceName = ifaceName;
				return ifaceName;
			},
			this.listProfiles,                  // fetch the profiles for the interface
			function (profiles) {
				return self._createProfileIfNeeded(profile, interfaceName, profiles);
			},
			function () {
				return self._connectProfile(profile, interfaceName);
			}
		]);
	},

	_connectProfile(profile, interfaceName) {
		var args = ['connect', 'name="'+profile+'"', 'interface="'+interfaceName+'"'];
		return this._execWiFiCommand(args);
	},

	/**
	 * Create the profile if it doesn't already exist.
	 * @param profile           The name of the profile to create (and the SSID of the open network to connect to.)
	 * @param interfaceName     The interface to create the profile on.
	 * @param profiles          The current list of profiles.
	 * @return the profile name or a promise to create the profile, resolving to the profile name
	 * @private
	 */
	_createProfileIfNeeded(profile, interfaceName, profiles) {
		if (!this._profileExists(profile, profiles)) {
			return this._createProfile(profile, interfaceName);
		}
		return profile;
	},

	_profileExists(profile, profiles) {
		return profiles.indexOf(profile)>=0;
	},

	/**
	 * Creates a open AP profile so that the AP can be subsequently connected to.
	 * @param profile           The name of the profile and the SSID to connect to
	 * @param interfaceName     The wifi interface to register the profile with
	 * @param _fs
	 * @returns {*}
	 * @private
	 */
	_createProfile(profile, interfaceName, fs) {
		if (!fs)
			fs = require('fs');
		var filename = '_wifi_profile.xml';
		var content = this._buildProfile(profile);
		var self = this;
		fs.writeFileSync(filename, content);
		var args = ['add', 'profile', 'filename="'+filename+'"'];
		if (interfaceName) {
			args.push('interface="'+interfaceName+'"');
		}
		return pipeline([function() {
			return self._execWiFiCommand(args)
		}])
		.finally(function() {
			fs.unlinkSync(filename);
		});
	},

	/**
	 * Validates that the given interface object is properly defined.
	 * @param {object} iface    The object to validate
	 * @throws Error if the interface is not valid
	 * @private
	 */
	_checkHasInterface: function(iface) {
		// todo - make this a programmatically identifiable error
		if (!iface || !iface.name) {
			throw Error('no Wi-Fi interface detected');
		}
		return iface.name;
	},

	/**
	 * Lists all the profiles registered, either for all interfaces or for a specific interface.
	 * @param {string} ifaceName    The name of the interface to list profiles for.
	 * @returns {Promise.<Array.<string>>}  An array of profile names
	 */
	listProfiles: function(ifaceName) {
		var self = this;
		var cmd = ['show', 'profiles'];
		if (ifaceName) {
			cmd.push('interface="'+ifaceName+'"');
		}
		return this._execWiFiCommand(cmd)
		.then(function(output) {
			var lines = self._stringToLines(output);
			return self._parseProfiles(lines);
		});
	},

	/**
	 * Parses the output of the "show profiles" command. Profiles are "type : name"-style key-value.
	 * @param lines
	 * @returns {Array}
	 * @private
	 */
	_parseProfiles: function(lines) {
		var profiles = [];
		for (var i=0; i<lines.length; i++) {
			var kv = this._keyValue(lines[i]);
			if (kv && kv.key && kv.value) {
				profiles.push(kv.value);
			}
		}
		return profiles;
	},

	/**
	 * Extracts the current interface from the list of interfaces.
	 * @param {Array.<string>} lines    The lines from the command output.
	 * @private
	 */
	_currentFromInterfaces: function(lines) {
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
	_extractInterface: function(lines, index) {
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
	_keyValue: function(line) {
		var colonIndex = line.indexOf(':');
		var result;
		if (colonIndex>0) {
			var key = line.slice(0, colonIndex).trim().toLowerCase();
			var value = line.slice(colonIndex+1).trim();
			result = { key: key, value: value };
		}
		return result;
	},

	_stringToLines: function(s) {
		return s.match(/[^\r\n]+/g) || [];
	},

	/**
	 * Creates a new open profile using the given ssid.
	 * @param {string} ssid The ssid of the AP to connect to. It is also the name of the profile.
	 * @returns {string}    The XML descriptor of the profile.
	 * @private
	 */
	_buildProfile(ssid) {
		// todo - xml encode profile name
		var result = '<?xml version="1.0"?> <WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"> <name>' + ssid + '</name> <SSIDConfig> <SSID> <name>' + ssid + '</name> </SSID> </SSIDConfig>';
		result += ' <connectionType>ESS</connectionType> <connectionMode>manual</connectionMode> <MSM> <security> <authEncryption> <authentication>open</authentication> <encryption>none</encryption> <useOneX>false</useOneX> </authEncryption> </security> </MSM>';
		result += " </WLANProfile>";
		return result;
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
	asCallback(new Connect().connect(opts.ssid), cb);
}

module.exports = {
	connect: connect,
	getCurrentNetwork: getCurrentNetwork,
	asCallback: asCallback,
	Connector: Connect
};
