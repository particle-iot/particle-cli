const _ = require('lodash');
const util = require('util');
const WiFiManager = require('../lib/wifi-manager');
const ApiClient = require('../lib/api-client');
const settings = require('../../settings');
const inquirer = require('inquirer');
const prompt = inquirer.prompt;
const chalk = require('chalk');
const scan = require('node-wifiscanner2').scan;
const SAP = require('softap-setup');
const path = require('path');
const spinnerMixin = require('../lib/spinner-mixin');

const strings = {
	'monitorPrompt': 'Would you like to wait and monitor for Photons entering setup mode?',
	'scanError': 'Unable to scan for Wi-Fi networks. Do you have permission to do that on this computer?',
	'credentialsNeeded': 'You will need to know the password for your Wi-Fi network (if any) to proceed.',
	'selectNetwork': 'Select the Wi-Fi network with which you wish to connect your Photon:',
	'startingSetup': "Congratulations, you're on your way to awesome",
	'rescanLabel': '[rescan networks]',
	'manualEntryLabel': '[manual entry]'
};

// TODO: DRY this up somehow
const cmd = path.basename(process.argv[1]);
const arrow = chalk.green('>');
const alert = chalk.yellow('!');

function protip() {
	const args = Array.prototype.slice.call(arguments);
	args.unshift(chalk.cyan('!'), chalk.bold.white('PROTIP:'));
	console.log.apply(null, args);
}

function updateWarning() {
	protip(
		'Your Photon may start a',
		chalk.cyan('firmware update'),
		'immediately upon connecting for the first time.'
	);
	protip(
		chalk.white('If it starts an update, you will see it flash'),
		chalk.magenta('MAGENTA'),
		chalk.white('until the update has completed.')
	);
}


module.exports = class WirelessCommand {
	constructor(options) {
		spinnerMixin(this);
		this.options = options;
		this.deviceFilterPattern = settings.wirelessSetupFilter;

		this.sap = new SAP();
		this.manual = false;
		this.api = new ApiClient();
		this.prompt = prompt;
	}

	list(macAddress, manual) {
		if (manual) {
			this.manual = true;
		}
		// if we get passed a MAC address from setup
		if (macAddress && macAddress.length === 17) {
			this.macAddressFilter = macAddress;
		} else {
			this.macAddressFilter = null;
		}

		console.log();

		if (manual) {
			return this.setup(null, manualDone);
		} else {
			protip('Wireless setup of Photons works like a', chalk.cyan('wizard!'));
			protip(
				'We will',
				chalk.cyan('automagically'),
				'change the',
				chalk.cyan('Wi-Fi'),
				'network to which your computer is connected.'
			);
			protip('You will lose your connection to the internet periodically.');
			console.log();

			this.newSpin('%s ' + chalk.bold.white('Scanning Wi-Fi for nearby Photons in setup mode...')).start();
			scan(this.networks.bind(this));
		}
	}


	/**
	 * Callback from scanning for wifi networks.
	 * @param err   Any error that happened during scanning
	 * @param dat   A list of APs that matched with these properties:
	 *  mac: MAC address for the AP
	 *  ssid: the SSID of the AP
	 * @private
	 */
	networks(err, dat) {

		const self = this;
		let detectedDevices = [];

		this.stopSpin();

		if (err) {

			protip(
				'Some computers may require',
				chalk.cyan('Administrator'),
				'permissions for my',
				chalk.cyan('automagical'),
				'Wi-Fi scanning capabilities.'
			);
			console.log();
			console.log(alert, chalk.bold.white('OOPS:'), 'I was unable to scan for nearby Wi-Fi networks', chalk.magenta('(-___-)'));
			console.log();

			return this.manualAsk(manualChoice);
		}

		detectedDevices = dat;
		if (this.macAddressFilter) {
			const macDevices = detectedDevices.filter((ap) => {
				return ap.mac && (ap.mac.toLowerCase() === self.macAddressFilter);
			});
			if (macDevices && macDevices.length === 1) {

				detectedDevices = macDevices;

			}
		}

		detectedDevices = ssids(filter(detectedDevices, self.deviceFilterPattern));

		if (detectedDevices.length > 1) {

			// Multiple Photons detected
			this.prompt([{

				type: 'confirm',
				name: 'setup',
				message: 'Multiple Photons detected nearby. Would you like to select one to setup now?',
				default: true,

			}]).then(multipleChoice);
		} else if (detectedDevices.length === 1) {

			// Perform wireless setup?
			this.prompt([{

				type: 'confirm',
				name: 'setupSingle',
				message: util.format(
					'Found "%s". Would you like to perform setup on this one now?',
					chalk.bold.cyan(detectedDevices[0])
				),
				default: true,

			}]).then(singleChoice);
		} else {

			console.log(
				arrow,
				chalk.bold.white('No nearby Photons detected.'),
				chalk.bold.white('Try the', '`' + chalk.bold.cyan(cmd + ' help') + '` command for more information.')
			);

			// Monitor for new Photons?
			this.prompt([{

				type: 'confirm',
				name: 'monitor',
				message: strings.monitorPrompt,
				default: true

			}]).then(monitorChoice);
		}

		function manualChoice(ans) {

			if (ans.manual) {

				// manual mode
				console.log();
				protip('Manual mode will', chalk.cyan('prompt'), 'you to manage the', chalk.cyan('Wi-Fi'), "connection of your computer when it's necessary.");
				protip('To proceed, you will need to be able to manually change the Wi-Fi connectivity of your computer.');
				protip("Your Photon will appear in your computer's list of Wi-Fi networks with a name like,", chalk.cyan('Photon-XXXX'));
				protip('Where', chalk.cyan('XXXX'), 'is a string of random letters and/or numbers', chalk.cyan('unique'), 'to that specific Photon.');

				self.manual = true;
				return self.setup(null, manualDone);
			}

			console.log();
			console.log(alert, 'Try running', chalk.cyan(cmd + ' setup'), 'with Administrator privileges.');
			console.log(alert, 'If the problem persists, please let us know:', chalk.cyan('https://community.particle.io/'));
			console.log();
		}

		function multipleChoice(ans) {

			if (ans.setup) {

				self.batch = false;

				// Select any/all Photons to setup
				return self.prompt([{

					type: 'list',
					name: 'selected',
					message: 'Please select which Photon you would like to setup at this time.',
					choices: detectedDevices

				}]).then(multipleAnswer);
			}
			self.exit();
		}

		function multipleAnswer(ans) {

			if (ans.selected) {

				return self.setup(ans.selected);
			}
			self.exit();
		}

		function singleChoice(ans) {

			if (ans.setupSingle) {
				self.setup(detectedDevices[0]);
			} else {
				// Monitor for new Photons?
				self.prompt([{

					type: 'confirm',
					name: 'monitor',
					message: strings.monitorPrompt,
					default: true

				}]).then(monitorChoice);
			}
		}

		function monitorChoice(ans) {

			if (ans.monitor) {

				console.log(arrow, chalk.bold.white('Monitoring nearby Wi-Fi networks for Photons. This may take up to a minute.'));
				self.monitor();
			} else {
				self.exit();
			}
		}
	}

	monitor(args) {

		const self = this;

		this.newSpin('%s ' + chalk.bold.white('Waiting for a wild Photon to appear... ') + chalk.white('(press ctrl + C to exit)')).start();
		wildPhotons();

		function wildPhotons() {

			scan((err, dat) => {
				if (err || !dat) {
					dat = [];
				}
				const foundPhotons = filter(dat, args || settings.wirelessSetupFilter);
				if (foundPhotons.length > 0) {

					self.networks(null, foundPhotons);
				} else {

					setTimeout(wildPhotons, 5000);
				}
			});
		}
	}

	setup(photon, cb) {
		const mgr = new WiFiManager();

		const self = this;
		this.ssid = photon;

		console.log();
		if (!photon && !self.manual) {

			console.log(alert, 'No Photons selected for setup!');
			return self.exit();

		}
		protip(strings.credentialsNeeded);
		protip('You can press ctrl + C to quit setup at any time.');
		console.log();

		if (mgr.supported.getCurrentNetwork) {
			mgr.getCurrentNetwork((err, network) => {
				if (err || !network) {
					return getClaim();
				}

				if (network.indexOf('Photon-') === 0) {
					console.log(
						chalk.bold.red('!'),
						chalk.bold.white('You are still connected to your Photon\'s Wi-Fi network. Please reconnect to a Wi-Fi network with internet access.')
					);
					console.log();
					self.prompt([{
						type: 'confirm',
						message: 'Have you reconnected to the internet?',
						default: true,
						name: 'reconnected'
					}]).then((ans) => {
						if (ans.reconnected) {
							return getClaim();
						}
						console.log(arrow, 'Goodbye!');
					});
					return;
				}
				return getClaim();
			});
		} else {
			return getClaim();
		}

		function getClaim() {
			self.newSpin('Obtaining magical secure claim code from the cloud...').start();
			self.api.getClaimCode().then((response) => {
				afterClaim(null, response);
			}, (error) => {
				afterClaim(error);
			});
		}

		function afterClaim(err, dat) {

			self.stopSpin();
			if (err) {

				// TODO: Graceful recovery here
				// How about retrying the claim code again
				// console.log(arrow, arrow, err);
				if (err.code === 'ENOTFOUND') {
					protip("Your computer couldn't find the cloud...");
				} else {
					protip('There was a network error while connecting to the cloud...');
				}
				protip('We need an active internet connection to successfully complete setup.');
				protip('Are you currently connected to the internet? Please double-check and try again.');
				return;
			}

			console.log(arrow, 'Obtained magical secure claim code.');
			console.log();
			self.claimCode = dat.claim_code;
			// todo - prompt for manual connection before getting the claim code since this exits the setup process
			if (!self.manual && !mgr.supported.connect) {
				console.log();
				console.log(alert, 'I am unable to automatically connect to Wi-Fi networks', chalk.magenta('(-___-)'));
				console.log();

				return self.manualAsk((ans) => {
					if (ans.manual) {
						self.manual = true;
						return manualConnect();
					}
					console.log(arrow, 'Goodbye!');
				});
			}

			if (!self.manual) {
				self.newSpin('Attempting to connect to ' + photon + '...').start();
				mgr.connect({ ssid: photon }, connected);
			} else {
				manualConnect();
			}

			function manualConnect() {
				return self.prompt([{

					type: 'input',
					name: 'connect',
					message: util.format('Please connect to the %s network now. Press enter when ready.', photon || 'Photon\'s Wi-Fi')

				}]).then(manualReady);
			}
		}

		function manualReady() {
			self.configure(null, manualConfigure);
		}

		function manualConfigure(err, dat) {
			cb(err, dat);
		}

		function connected(err, opts) {

			self.stopSpin();
			if (err) {
				// TODO: Max retries, help output when reached.
				console.log(
					chalk.bold.red('!'),
					chalk.bold.white('Woops. Something went wrong connecting to ' + photon + '. Please manually re-connect to your Wi-Fi network.')
				);
				return;
			}
			console.log(
				arrow,
				'Hey! We successfully connected to',
				chalk.bold.cyan(opts.ssid)
			);
			self.configure(opts.ssid);
		}
	}

	/* eslint-disable max-statements */
	configure(ssid, cb) {

		console.log();

		// todo - distinguish Photon/P1
		console.log(arrow, 'Now to configure our precious', chalk.cyan(ssid ? ssid : 'Photon'));
		console.log();

		const self = this;
		const sap = this.sap;
		const mgr = new WiFiManager();
		const list = [];
		let password;
		let network;
		let retry;
		let retries = 0;
		let security;
		let params = {};
		let isEnterprise = false;

		protip('If you want to skip scanning, or your network is configured as a');
		protip(chalk.cyan('non-broadcast'), 'network, please choose No to the next prompt to enter manual mode.');
		console.log();

		self.prompt([{

			type: 'confirm',
			name: 'auto',
			message: 'Shall I have the Photon scan for available Wi-Fi networks?',
			default: true

		}]).then(scanChoice);

		function scanChoice(ans) {

			if (!ans.auto) {

				return self.prompt([{

					type: 'input',
					name: 'network',
					message: 'Please enter the SSID of your Wi-Fi network:'

				}, {

					type: 'list',
					name: 'security',
					message: 'Please select the security used by your Wi-Fi network:',
					choices: [

						'None',
						'WEP Shared',
						'WPA TKIP',
						'WPA AES',
						'WPA2 AES',
						'WPA2 TKIP',
						'WPA2 Mixed',
						'WPA2',
						'WPA2 Enterprise',
						'WPA2 Enterprise AES',
						'WPA2 Enterprise TKIP',
						'WPA2 Enterprise Mixed',
						'WPA Enterprise AES',
						'WPA Enterprise TKIP'
					]

				}, {

					type: 'input',
					name: 'password',
					message: 'Please enter your Wi-Fi network password:',
					when: (ans) => {
						return ans.security !== 'None' && ans.security.indexOf('Enterprise') < 0;
					},
					validate: (input) => {
						if (input && input.trim()) {
							return true;
						}
						return "You must enter a password. Let's try again...";
					}

				}]).then(manualChoices);
			}

			self.newSpin('Asking the Photon to scan for nearby Wi-Fi networks...').start();
			retry = setTimeout(start, 1000);

		}

		function enterpriseChoices(ans) {
			self.prompt([
				{
					type: 'list',
					name: 'eap',
					message: 'EAP Type',
					choices: [
						'PEAP/MSCHAPv2',
						'EAP-TLS'
					]
				},
				{
					type: 'input',
					name: 'username',
					message: 'Username',
					when: (ans) => {
						return sap.eapTypeValue(ans.eap) === sap.eapTypeValue('peap');
					},
					validate: (val) => {
						return !!val;
					}
				},
				{
					type: 'input',
					name: 'password',
					message: 'Password',
					when: (ans) => {
						return sap.eapTypeValue(ans.eap) === sap.eapTypeValue('peap');
					},
					validate: (val) => {
						return !!val;
					}
				},
				{
					type: 'editor',
					name: 'client_certificate',
					message: 'Client certificate in PEM format',
					when: (ans) => {
						return sap.eapTypeValue(ans.eap) === sap.eapTypeValue('tls');
					},
					validate: (val) => {
						return !!val;
					}
				},
				{
					type: 'editor',
					name: 'private_key',
					message: 'Private key in PEM format',
					when: (ans) => {
						return sap.eapTypeValue(ans.eap) === sap.eapTypeValue('tls');
					},
					validate: (val) => {
						return !!val;
					}
				},
				{
					type: 'input',
					name: 'outer_identity',
					message: 'Outer identity (optional)'
				},
				{
					type: 'confirm',
					name: 'provide_root_ca',
					message: 'Would you like to provide CA certificate?',
					default: true
				},
				{
					type: 'editor',
					name: 'root_ca',
					message: 'CA certificate in PEM format',
					when: (answers) => {
						return answers.provide_root_ca;
					},
					validate: (val) => {
						return !!val;
					},
					default: null
				}
			]).then((res) => {
				res = _.merge(ans, res);
				networkChoices(res);
			});
		}

		function manualChoices(ans) {

			if (!ans.network) {

				console.log(alert, "We can't setup your Photon without a Wi-Fi network! Let's try again...");
				return scanChoice({ auto: false });
			}
			if (!ans.password && ans.security !== 'None' && ans.security.indexOf('Enterprise') < 0) {

				console.log(alert, "You chose a security type that requires a password! Let's try again...");
				return scanChoice({ auto: false });
			}
			if (ans.security.indexOf('Enterprise') >= 0) {
				return enterpriseChoices({
					network: ans.network,
					security: ans.security.toLowerCase().replace(' ', '_')
				});
			}
			networkChoices({
				network: ans.network,
				password: ans.password,
				security: ans.security.toLowerCase().replace(' ', '_')
			});
		}

		function start() {

			clearTimeout(retry);

			if (retries >= 9) { // scan has failed 10 times already
				self.stopSpin();

				console.log(
					arrow,
					'Your Photon failed to scan for nearby Wi-Fi networks.'
				);
				retries = 0;
				self.prompt([{
					type: 'confirm',
					name: 'manual',
					message: 'Would you like to manually enter your Wi-Fi network configuration?',
					default: true

				}]).then((ans) => {
					return scanChoice({ auto: !ans.manual });
				});
				return;
			}

			sap.scan(results);
		}

		function results(err, dat) {
			clearTimeout(retry);
			self.stopSpin();

			if (err) {
				console.error(err);
				console.log(
					arrow,
					'Your Photon encountered an error while trying to scan for nearby Wi-Fi networks. Retrying...'
				);
				retry = setTimeout(start, 2000);
				retries++;
				return;
			}
			let networks = dat;

			dat.forEach((ap) => {
				list[ap.ssid] = ap;
			});

			networks = removePhotonNetworks(ssids(networks));

			const noNetworks = networks.length === 0;

			networks.unshift(new inquirer.Separator());
			networks.unshift(strings.rescanLabel);
			if (noNetworks) {
				networks.unshift(strings.manualEntryLabel);
			}
			networks.unshift(new inquirer.Separator());

			self.prompt([{
				type: 'list',
				name: 'network',
				message: 'Please select the network to which your Photon should connect:',
				choices: networks
			}]).then(networkChoice);

			function networkChoice(ans) {
				if (ans.network === strings.rescanLabel) {

					console.log();
					self.newSpin('Asking the Photon to re-scan nearby Wi-Fi networks...').start();
					return start();
				}

				if (ans.network === strings.manualEntryLabel) {
					scanChoice({ auto: false });
					return;
				}

				network = ans.network;

				if (list[network].sec === 0) {
					return networkChoices({ network: network });
				}

				if (list[network].sec & self.sap.securityValue('enterprise')) {
					enterpriseChoices({ network: network, security: list[network].sec });
				} else {
					self.prompt([{

						type: 'input',
						name: 'password',
						message: 'Please enter your network password:'

					}]).then(passwordChoice);
				}
			}

			function passwordChoice(ans) {
				networkChoices({ network: network, password: ans.password });
			}
		}

		function networkChoices(ans) {

			network = ans.network;
			password = ans.password;
			security = ans.security || list[network].sec;

			let visibleSecurity;
			if (self.sap.securityLookup(security)) {
				visibleSecurity = self.sap.securityLookup(security).toUpperCase().replace('_', ' ');
			} else {
				visibleSecurity = security.toUpperCase().replace('_', ' ');
			}

			console.log(arrow, "Here's what we're going to send to the Photon:");
			console.log();
			console.log(arrow, 'Wi-Fi Network:', chalk.bold.cyan(network));
			console.log(
				arrow,
				'Security:',
				chalk.bold.cyan(visibleSecurity)
			);
			if (visibleSecurity.toLowerCase().indexOf('enterprise') < 0) {
				console.log(arrow, 'Password:', chalk.bold.cyan(password || '[none]'));
			} else {
				isEnterprise = true;
				console.log(arrow, 'EAP Type: ', chalk.bold.cyan(ans.eap));
				if (sap.eapTypeValue(ans.eap) === sap.eapTypeValue('peap')) {
					console.log(arrow, 'Username: ', chalk.bold.cyan(ans.username));
					console.log(arrow, 'Password:', chalk.bold.cyan(password || '[none]'));
				} else {
					// EAP-TLS
					console.log(arrow, 'Client certificate: ', chalk.bold.cyan(ans.client_certificate ? '[present]' : '[empty]'));
					console.log(arrow, 'Private key: ', chalk.bold.cyan(ans.private_key ? '[present]' : '[empty]'));
				}
				console.log(arrow, 'Outer identity:', chalk.bold.cyan(ans.outer_identity || '(default - anonymous)'));
				console.log(arrow, 'CA certificate: ', chalk.bold.cyan(ans.root_ca ? '[present]' : '[empty]'));
			}
			console.log();

			params = ans;
			params.visibleSecurity = visibleSecurity;

			self.prompt([{
				type: 'confirm',
				name: 'continue',
				message: 'Would you like to continue with the information shown above?',
				default: true,
			}]).then(continueChoice);
		}

		function continueChoice(ans) {

			if (!ans.continue) {
				console.log(arrow, "Let's try again...");
				console.log();
				return self.configure(ssid, cb);
			}
			self.network = network;
			if (!isEnterprise) {
				self.password = password;
			}

			info();
		}

		function info() {

			clearTimeout(retry);

			console.log();
			console.log(arrow, 'Obtaining device information...');


			// todo - this is the first attempt to connect to the photon
			// if the network hasn't switched then the connection process may hang
			sap.deviceInfo(pubKey);
		}

		function pubKey(err, dat) {
			if (err) {
				retry = setTimeout(info, 1000);
				return;
			}

			if (dat && dat.id) {
				self.deviceID = dat.id;
				console.log(arrow, 'Setting up device id', chalk.bold.cyan(dat.id.toLowerCase()));
			}
			clearTimeout(retry);
			console.log(arrow, 'Requesting public key from the device...');
			sap.publicKey(code);
		}

		function code(err) {
			if (err) {
				retry = setTimeout(pubKey, 1000);
				return;
			}

			clearTimeout(retry);
			console.log(arrow, 'Setting the magical cloud claim code...');
			sap.setClaimCode(self.claimCode, configure);
		}

		function configure(err) {
			if (err) {
				retry = setTimeout(code, 1000);
				return;
			}

			const conf = {
				ssid: network,
				security: security,
				password: password,

				eap: params.eap,
				username: params.username,
				client_certificate: params.client_certificate,
				private_key: params.private_key,
				outer_identity: params.outer_identity,
				root_ca: params.root_ca
			};

			clearTimeout(retry);
			console.log(arrow, 'Telling the Photon to apply your Wi-Fi configuration...');
			sap.configure(conf, connect);
		}

		function connect(err) {
			if (err) {
				retry = setTimeout(configure, 1000);
				return;
			}

			console.log(arrow, 'The Photon will now attempt to connect to your Wi-Fi network...');
			console.log();
			clearTimeout(retry);
			sap.connect(done);
		}

		function done(err) {
			if (err) {
				retry = setTimeout(connect, 1000);
				return;
			}

			self.stopSpin();
			clearTimeout(retry);

			self.stopSpin();
			//console.log(arrow, chalk.bold.white('Configuration complete! You\'ve just won the internet!'));

			if (!self.manual && !isEnterprise) {
				reconnect(false);
			} else {
				manualReconnectPrompt();
			}
		}

		function manualReconnectPrompt() {
			self.prompt([{
				name: 'reconnect',
				type: 'input',
				message: 'Please re-connect your computer to your Wi-Fi network now. Press enter when ready.'
			}]).then(manualPrompt);
		}

		function manualPrompt() {
			reconnect(true);
		}

		function reconnect(manual) {
			if (!manual) {
				self.newSpin('Reconnecting your computer to your Wi-Fi network...').start();
				mgr.connect({ ssid: self.network, password: self.password }, revived);
			} else {
				revived();
			}
		}

		function revived(err) {
			if (err) {
				manualReconnectPrompt();
				return;
			}

			self.stopSpin();
			self.newSpin("Attempting to verify the Photon's connection to the cloud...").start();

			setTimeout(() => {
				self.api.listDevices({ silent: true }).then((body) => {
					checkDevices(null, body);
				}, (error) => {
					checkDevices(error);
				});
			}, 2000);

		}

		function checkDevices(err, dat) {

			self.stopSpin();
			if (err) {
				if (err.code === 'ENOTFOUND') {
					// todo - limit the number of retries here.
					console.log(alert, 'Network not ready yet, retrying...');
					console.log();
					return revived(null);
				}
				console.log(alert, 'Unable to verify your Photon\'s connection.');
				console.log(alert, "Please make sure you're connected to the internet.");
				console.log(alert, 'Then try', chalk.bold.cyan(cmd + ' list'), "to verify it's connected.");

				updateWarning();
				self.exit();
			}

			const onlinePhoton = _.find(dat, (device) => {
				return (device.id.toUpperCase() === self.deviceID.toUpperCase()) && device.connected === true;
			});

			if (onlinePhoton) {
				console.log(arrow, 'It looks like your Photon has made it happily to the cloud!');
				console.log();
				updateWarning();
				namePhoton(onlinePhoton.id);
				return;
			}

			console.log(alert, "It doesn't look like your Photon has made it to the cloud yet.");
			console.log();
			self.prompt([{

				type: 'list',
				name: 'recheck',
				message: 'What would you like to do?',
				choices: [
					{ name: 'Check again to see if the Photon has connected', value: 'recheck' },
					{ name: 'Reconfigure the Wi-Fi settings of the Photon', value: 'reconfigure' }
				]

			}]).then(recheck);

			function recheck(ans) {
				if (ans.recheck === 'recheck') {
					self.api.listDevices({ silent: true }).then((body) => {
						checkDevices(null, body);
					}, (error) => {
						checkDevices(error);
					});
				} else {
					self.setup(self.ssid);
				}
			}
		}

		function namePhoton(deviceId) {
			self.prompt([
				{
					type: 'input',
					name: 'deviceName',
					message: 'What would you like to call your Photon (Enter to skip)?'
				}
			]).then((ans) => {
				// todo - retrieve existing name of the device?
				const deviceName = ans.deviceName;
				if (deviceName) {
					self.api.renameDevice(deviceId, deviceName).then(() => {
						console.log();
						console.log(arrow, 'Your Photon has been given the name', chalk.bold.cyan(deviceName));
						console.log(arrow, "Congratulations! You've just won the internet!");
						console.log();
						self.exit();
					}, (err) => {
						console.error(alert, 'Error naming your photon: ', err);
						namePhoton(deviceId);
					});
				} else {
					console.log('Skipping device naming.');
					self.exit();
				}
			});
		}
	}
	/* eslint-enable max-statements */

	manualAsk(cb) {
		return this.prompt([{

			type: 'confirm',
			name: 'manual',
			message: "We can still proceed in 'manual' mode. Would you like to continue?",
			default: true

		}]).then(cb);
	}

	exit() {

		console.log();
		console.log(arrow, chalk.bold.white('Ok, bye! Don\'t forget `' +
			chalk.bold.cyan(cmd + ' help') + '` if you\'re stuck!',
		chalk.bold.magenta('<3'))
		);
		process.exit(0);
	}
};


function manualDone(err, dat) {
	if (err) {
		return console.log(chalk.read('!'), 'An error occurred:', err);
	}
	if (dat && dat.id) {
		return console.log(arrow, 'We successfully configured your Photon! Great work. We make a good team!', chalk.magenta('<3'));
	}
}

function filter(list, pattern, inverse) {
	// const returnedOne = false;
	return list.filter((ap) => {
		// if(!returnedOne && ap.ssid.match(pattern)) {
		//  returnedOne = true
		//  return true
		// }
		// return false
		return inverse ? !ap.ssid.match(pattern) : ap.ssid.match(pattern);
	});
}

function ssids(list) {
	return clean(list).map((ap) => {
		return ap.ssid;
	});
}

function removePhotonNetworks(ssids) {
	return ssids.filter((ap) => {
		if (ap.indexOf('Photon-') === 0) {
			return false;
		}
		return true;
	});
}

function clean(list) {
	const dupes = [];

	return list
		.sort((a, b) => {
			if (a.ssid && !b.ssid) {
				return 1;
			} else if (b.ssid && !a.ssid) {
				return -1;
			}

			return a.ssid.localeCompare(b.ssid);
		})
		.filter((ap) => {
			if (dupes[ap.ssid]) {
				return false;
			}

			dupes[ap.ssid] = true;
			return true;
		});
}

