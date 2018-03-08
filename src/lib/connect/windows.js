const systemExecutor = require('./executor').systemExecutor;
const when = require('when');
const pipeline = require('when/pipeline');


/**
 * @param commandExecutor   A function that returns a promise to execute a given command.
 * @constructor
 */
class Connect {
	constructor(commandExecutor) {
		this.commandExecutor = commandExecutor || systemExecutor;
	}

	_execWiFiCommand(cmdArgs) {
		return this._exec(['netsh', 'wlan'].concat(cmdArgs));
	}

	_exec(cmdArgs) {
		return this.commandExecutor(cmdArgs);
	}

	/**
	 * Retrieves the profile name of the currently connected network.
	 * @returns {Promise.<String>}  The profile name of the currently connected network, or undefined if no

	 connection.
	 */
	current() {
		return this.currentInterface()
			.then((iface) => {
				return iface ? iface.profile : undefined;
			});
	}

	/**
	 * Determine the current network interface.
	 * @return {Promise.<Object>} the current network interface object
	 */
	currentInterface() {
		const self = this;
		return this._execWiFiCommand(['show', 'interfaces'])
			.then((output) => {
				const lines = self._stringToLines(output);
				let iface = self._currentFromInterfaces(lines);
				if (iface && !iface['profile']) {
					iface = null;
				}
				return iface;
			});
	}

	/**
	 * Connect the wifi interface to the given access point with the named profile.
	 * If the profile already exists, it is used. Otherwise a new profile for an open AP is created.
	 */
	connect(profile) {
		const self = this;
		let interfaceName;
		return pipeline([
			this.currentInterface.bind(this),      		// find the current interface
			this._checkHasInterface.bind(this),            // fail if no interfaces
			(ifaceName) => {              // save the interface name
				interfaceName = ifaceName;
				return ifaceName;
			},
			this.listProfiles.bind(this),                  // fetch the profiles for the interface
			(profiles) => {
				return self._createProfileIfNeeded(profile, interfaceName, profiles);
			},
			() => {
				return self._connectProfile(profile, interfaceName);
			}
		]);
	}

	_connectProfile(profile, interfaceName) {
		const self = this;
		const args = ['connect', 'name='+profile, 'interface='+interfaceName];
		return this._execWiFiCommand(args)
		.then(() => {
			return self.waitForConnected(profile, interfaceName, 20, 500);
		})
		.then(() => {
			return { ssid: profile };
		});
	}

	waitForConnected(profile, interfaceName, count, retryPeriod, dfd) {
		const self = this;
		dfd = dfd || when.defer();
		return this.current()
			.then((ssid) => {
				if (ssid!==profile) {
					if (--count <= 0) {
						dfd.reject(new Error('timeout waiting for network to connect'));
					}	else {
						setTimeout(() => {
							self.waitForConnected(profile, interfaceName, count, retryPeriod, dfd);
						}, retryPeriod);
					}
				} else {
					dfd.resolve(ssid);
				}
				return dfd.promise;
			});
	}

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
	}

	_profileExists(profile, profiles) {
		return profiles.indexOf(profile)>=0;
	}

	/**
	 * Creates a open AP profile so that the AP can be subsequently connected to.
	 * @param profile           The name of the profile and the SSID to connect to
	 * @param interfaceName     The wifi interface to register the profile with
	 * @param _fs
	 * @returns {*}
	 * @private
	 */
	_createProfile(profile, interfaceName, fs) {
		fs = fs || require('fs');
		const filename = '_wifi_profile.xml';
		const content = this._buildProfile(profile);
		const self = this;
		fs.writeFileSync(filename, content);
		const args = ['add', 'profile', 'filename='+filename+''];
		if (interfaceName) {
			args.push('interface='+interfaceName);
		}
		return pipeline([() => {
			return self._execWiFiCommand(args);
		}])
		.finally(() => {
			fs.unlinkSync(filename);
		});
	}

	/**
	 * Validates that the given interface object is properly defined.
	 * @param {object} iface    The object to validate
	 * @throws Error if the interface is not valid
	 * @private
	 */
	_checkHasInterface(iface) {
		// todo - make this a programmatically identifiable error
		if (!iface || !iface.name) {
			throw Error('no Wi-Fi interface detected');
		}
		return iface.name;
	}

	/**
	 * Lists all the profiles registered, either for all interfaces or for a specific interface.
	 * @param {string} ifaceName    The name of the interface to list profiles for.
	 * @returns {Promise.<Array.<string>>}  An array of profile names
	 */
	listProfiles(ifaceName) {
		const self = this;
		const cmd = ['show', 'profiles'];
		if (ifaceName) {
			cmd.push('interface='+ifaceName);
		}
		return this._execWiFiCommand(cmd)
			.then((output) => {
				const lines = self._stringToLines(output);
				return self._parseProfiles(lines);
			});
	}

	/**
	 * Parses the output of the "show profiles" command. Profiles are "type : name"-style key-value.
	 * @param lines
	 * @returns {Array}
	 * @private
	 */
	_parseProfiles(lines) {
		const profiles = [];
		for (let i=0; i<lines.length; i++) {
			const kv = this._keyValue(lines[i]);
			if (kv && kv.key && kv.value) {
				profiles.push(kv.value);
			}
		}
		return profiles;
	}

	/**
	 * Extracts the current interface from the list of interfaces.
	 * @param {Array.<string>} lines    The lines from the command output.
	 * @private
	 */
	_currentFromInterfaces(lines) {
		let idx = 0;
		let iface;
		while (idx < lines.length && (!iface || !iface['profile'])) {
			const data = this._extractInterface(lines, idx);
			iface = data.iface;
			idx = data.range.end;
		}
		return iface;
	}

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
		const result = { iface: {}, range: {} };
		const name = 'name';
		let kv;
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
			if (!kv)				{
				continue;
			}

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
	}

	/**
	 * Extract a key and value from a string like ':'
	 * @param line
	 * @private
	 */
	_keyValue(line) {
		const colonIndex = line.indexOf(':');
		let result;
		if (colonIndex>0) {
			const key = line.slice(0, colonIndex).trim().toLowerCase();
			const value = line.slice(colonIndex+1).trim();
			result = { key: key, value: value };
		}
		return result;
	}

	_stringToLines(s) {
		return s.match(/[^\r\n]+/g) || [];
	}

	/**
	 * Creates a new open profile using the given ssid.
	 * @param {string} ssid The ssid of the AP to connect to. It is also the name of the profile.
	 * @returns {string}    The XML descriptor of the profile.
	 * @private
	 */
	_buildProfile(ssid) {
		// todo - xml encode profile name
		let result = '<?xml version="1.0"?> <WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"> <name>' + ssid + '</name> <SSIDConfig> <SSID> <name>' + ssid + '</name> </SSID> </SSIDConfig>';
		result += ' <connectionType>ESS</connectionType> <connectionMode>manual</connectionMode> <MSM> <security> <authEncryption> <authentication>open</authentication> <encryption>none</encryption> <useOneX>false</useOneX> </authEncryption> </security> </MSM>';
		result += ' </WLANProfile>';
		return result;
	}
}

function asCallback(promise, cb) {
	const result = promise.then((arg) => {
		try {
			cb(null, arg);
		} catch (err) {
			// what do to with this?
		}
	}).catch((error) => {
		cb(error);
	});
	return result;
}

function getCurrentNetwork(cb, connect) {
	connect = connect || new Connect();
	asCallback(connect.current(), cb);
}

/**
 *
 * @param opts
 *  - ssid property is the SSID of the network to connect to.
 *  - profileName is the name of the network profile to connect to. Defaults to ssid if not defined.
 * @param cb
 * @param connect   The Connector() instance to use. If not defined a new Connector instance will be provided.
 */
function connect(opts, cb, connect) {
	connect = connect || new Connect();
	asCallback(connect.connect(opts.ssid), cb);
}

module.exports = {
	connect: connect,
	getCurrentNetwork: getCurrentNetwork,
	asCallback: asCallback,
	Connector: Connect
};
