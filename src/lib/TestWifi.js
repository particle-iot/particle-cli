const prompt = require('inquirer').prompt;
const os = require('os');
const scan = require('node-wifiscanner2').scan;
const WiFiManager = require('./WiFiManager');


class TestWiFi {
	constructor() {
		this.mgr = new WiFiManager();
		this._next = null;
		this.wirelessSetupFilter = /^Photon-.*$/;
	}

	setNext(fn) {
		this._next = fn;
	}

	next() {
		let fn = this._next;
		this._next = null;
		if (fn) {
			fn();
		}
	}

	run() {
		if (this.mgr.osConnect) {
			console.log('Using Wi-Fi connector for the current platform ' + os.platform());
			this.setNext(this.selectNetwork.bind(this));
			this.mgr.getCurrentNetwork(this.handleCurrentNetwork.bind(this));
		} else {
			console.error('No Wi-Fi connector for the current platform ' + os.platform());
		}
	}

	handleCurrentNetwork(err, network) {
		if (err) {
			console.err('Unable to get current network:', err);
		} else {
			console.log('Current network detected as', network);
			prompt([{
				type: 'confirm',
				message: 'Is that correct?',
				default: true,
				name: 'correct'
			}], (ans) => {
				if (ans.correct) {
					this.originalNetwork = network;
					this.next();
					return;
				}
				console.error('Incorrect network was detected.');
			});
		}
	}

	selectNetwork() {
		console.log('Scanning for nearby networks matching', this.wirelessSetupFilter);
		scan((err, aps) => {
			if (err) {
				console.log('unable to scan for wifi networks:', err);
				return;
			}

			console.log('Found', aps.length, 'networks.');

			let photons = ssids(filter(aps, this.wirelessSetupFilter));
			console.log('Found', photons.length, 'photons.');
			if (photons.length) {
				console.log(photons);
				return prompt([{
					type: 'list',
					name: 'selected',
					message: 'Please select which Photon network you would like to switch to:',
					choices: photons
				}]).then((ans) => {
					if (ans.selected) {
						this.setNext(() => {
							console.log('Restoring to original network', this.originalNetwork);
							this.connect(this.originalNetwork);
						});
						this.connect(ans.selected);
					}
				});
			}
		});
	}

	/**
	 * Connect to the given network
	 * @param ssid
	 */
	connect(ssid) {
		console.log('Connecting to network', ssid);
		this.mgr.connect({ ssid: ssid }, (err, opts) => {
			if (err) {
				console.error('Unable to connect to network', ssid, ':', err);
				return;
			}

			console.log('connected to network ', opts.ssid);
			this.mgr.getCurrentNetwork((err, current) => {
				if (err) {
					console.error('Unable to detect current network:', err);
					return;
				}
				console.log('current network detected as', current);
				if (current !== ssid) {
					console.error('Current network should have been', ssid);
					return;
				}

				prompt([{
					type: 'confirm',
					message: 'Is that correct? (Please verify your computer is connected to this network.)',
					default: true,
					name: 'correct'
				}]).then((ans) => {
					if (ans.correct) {
						this.next();
						return;
					}
					console.error('Incorrect network was detected.');
				});
			});
		});
	}
}

function filter(list, pattern) {
	// var returnedOne = false;
	return list.filter((ap) => {
		// if(!returnedOne && ap.ssid.match(pattern)) {
		// 	returnedOne = true
		// 	return true
		// }
		// return false
		return ap.ssid.match(pattern);
	});
}

function ssids(list) {
	return list.map((ap) => {
		return ap.ssid;
	});
}

module.exports = TestWiFi;
