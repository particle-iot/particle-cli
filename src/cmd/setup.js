const util = require('util');
const path = require('path');
const chalk = require('chalk');
const prompt = require('inquirer').prompt;
const settings = require('../../settings');
const ApiClient = require('../lib/api-client');
const spinnerMixin = require('../lib/spinner-mixin');
const { banner, retryDeferred } = require('../lib/utilities');

// this is mainly so we only break 80 columns in one place.
const strings = {
	'alreadyLoggedIn': 'It appears as though you are already logged in as %s',
	'revokeAuthPrompt': 'Would you like to use the current authentication token?',
	'signupSuccess': "Great success! You're now the owner of a brand new account!",
	'loginError': "There was an error logging you in! Let's try again.",
	'helpForMoreInfo': 'Please try the `%s help` command for more information.'
};

// TODO: DRY this up somehow
const cmd = path.basename(process.argv[1]);
const alert = chalk.yellow('!');
const arrow = chalk.green('>');

function goodbye() {
	console.log(arrow, 'Goodbye!');
}


module.exports = class SetupCommand {
	constructor() {
		spinnerMixin(this);
		this.api = new ApiClient();
	}

	command(name, options = { params: {} }) {
		const Command = require(`./${name}`);
		return new Command(options);
	}

	setup({ wifi, scan, manual, yes }) {
		this.options = { scan, manual, yes };

		const self = this;

		this.forceWiFi = wifi;

		console.log(chalk.bold.cyan(banner()));
		console.log(arrow, "Setup is easy! Let's get started...");

		loginCheck();

		function loginCheck() {
			self.wasLoggedIn = !!settings.username;

			if (settings.access_token) {
				return promptSwitch();
			}

			// not logged in, go signup/login.
			accountStatus(false);
		}

		function promptSwitch() {

			console.log(
				arrow,
				util.format(strings.alreadyLoggedIn,
					chalk.bold.cyan(settings.username))
			);

			self.prompt([{

				type: 'confirm',
				name: 'switch',
				message: 'Would you like to use this account?',
				default: true

			}]).then(switchChoice);
		}

		function switchChoice(ans) {
			// user wants to logout
			if (!ans.switch) {
				return self.command('cloud').logout(true).then(() => {
					self.api.clearToken();
					accountStatus(false);
				});
			} else {
				// user has remained logged in
				accountStatus(true);
			}
		}

		function accountStatus(alreadyLoggedIn) {

			const nextFn = self.findDevice.bind(self);

			if (!alreadyLoggedIn) {
				// New user or a fresh environment!
				if (!self.wasLoggedIn) {
					self.prompt([
						{
							type: 'list',
							name: 'login',
							message: 'Hello Stranger! This seems to be your first time here. What would you like to do?',
							choices: [
								{ name: 'Create a new account', value: false },
								{ name: 'Login', value: true }
							]
						}
					]).then((answers) => {
						if (answers.login) {
							return self.login(nextFn);
						}
						return self.signup(nextFn);
					});

					return;
				}

				// Not-new user!
				return self.login(nextFn);
			}

			nextFn();
		}
	}

	signup(cb, tries) {
		if (!tries) {
			tries = 1;
		} else if (tries && tries > 3) {
			console.log(alert, 'Something is going wrong with the signup process.');
			return console.log(
				alert,
				util.format(strings.helpForMoreInfo,
					chalk.bold.cyan(cmd))
			);
		}
		const self = this;
		const signupUsername = this.signupUsername || undefined;
		console.log(arrow, "Let's create your new account!");

		self.prompt([{

			type: 'input',
			name: 'username',
			message: 'Please enter a valid email address:',
			default: signupUsername,
			validate: (value) => {
				if (value && value.indexOf('@') > 0 && value.indexOf('.') > 0) {
					// TODO check with API that this is an unused email
					return true;
				}
				return 'Make sure you enter a valid email address';
			}

		}, {

			type: 'password',
			name: 'password',
			message: 'Please enter a secure password:',
			validate: (value) => {
				if (!value) {
					return "I'm afraid your password cannot be empty. Try again.";
				}
				return true;
			}
		}, {

			type: 'password',
			name: 'confirm',
			message: 'Please confirm your password:',
			validate: (value) => {
				if (!value) {
					return "I'm afraid your password cannot be empty. Try again.";
				}
				return true;
			}

		}]).then(signupInput);

		function signupInput(ans) {
			if (ans.confirm !== ans.password) {

				// try to remember username to save them some frustration
				if (ans.username) {
					self.signupUsername = ans.username;
				}
				console.log(
					arrow,
					"Sorry, those passwords didn't match. Let's try again!"
				);
				return self.signup(cb, ++tries);
			}

			self.api.createUser(ans.username, ans.password).then(() => {
				// Login the new user automatically
				return self.api.login(settings.clientId, ans.username, ans.password);
			}).then((response) => {
				const token = response.access_token;
				settings.override(null, 'access_token', token);
				settings.override(null, 'username', ans.username);
				console.log(arrow, strings.signupSuccess);
				cb(null);
			}).catch((signupErr) => {
				console.error(signupErr);
				console.error(alert, "Oops, that didn't seem to work. Let's try that again");
				return self.signup(cb, ++tries);
			});
		}
	}

	login(cb) {
		const self = this;

		console.log(arrow, "Let's get you logged in!");

		this.command('cloud').login().then((accessToken) => {
			self.api.updateToken(accessToken);
			cb();
		}).catch(() => {});
	}

	findDevice() {
		const self = this;
		const serial = this.command('serial');
		const wireless = this.command('wireless');
		wireless.prompt = this.prompt.bind(this);
		serial.prompt = this.prompt.bind(this);

		console.log();
		console.log(
			chalk.cyan('!'),
			'PROTIP:',
			chalk.white('Hold the'),
			chalk.cyan('MODE/SETUP'),
			chalk.white('button on your device until it'),
			chalk.cyan('blinks blue!')
		);

		console.log(
			chalk.cyan('!'),
			'PROTIP:',
			chalk.white('Please make sure you are'),
			chalk.cyan('connected'),
			chalk.white('to the'),
			chalk.cyan('internet.'),
			'\n'
		);

		this.newSpin('Now to find your device(s)...').start();

		return serial.findDevices().then(devices => {

			self.stopSpin();

			if (devices.length > 0) {
				if (devices.length > 1) {

					console.log(
						alert,
						'NOTICE:',
						chalk.blue('Multiple devices detected. Please run',
							chalk.bold.cyan(cmd + ' setup'),
							'again to setup subsequent devices.'
						)
					);
				}
				// TODO: something other than just doing the first one.
				return inspect(devices[0]);
			}

			console.log(arrow, 'No devices detected via USB.');

			tryScan();
		});

		function tryScan() {
			// TODO: check if Wi-Fi scanning is available (requires OS support and a wifi adapter.)
			self.prompt([{

				type: 'confirm',
				name: 'scan',
				message: 'Would you like to scan for nearby Photons in Wi-Fi setup mode?',
				default: true

			}]).then(scanChoice);

			function scanChoice(ans) {
				if (ans.scan) {
					return wireless.list(undefined, self.options.manual);
				}
				goodbye();
			}
		}

		function inspect(device) {

			// TODO: Update deviceSpecs to include DFU & non-DFU PIDs, use here
			if (device.type === 'Core') {

				detectedPrompt('Core', function setupCoreChoice(ans) {

					if (ans.setup) {
						return self.setupCore(device);
					}
					goodbye();
				});
			} else if (device.type === 'Photon' || device.type === 'P1') {

				// Photon detected
				detectedPrompt(device.type, function setupPhotonChoice(ans) {

					if (ans.setup) {
						let macAddress;
						self.newSpin('Getting device information...').start();

						serial.supportsClaimCode(device).then((supported) => {
							if (supported && !self.forceWiFi) {
								self.stopSpin();
								console.log(
									chalk.cyan('!'),
									'The device supports setup via serial.'
								);
								return serial.setup(device);
							}

							serial.getDeviceMacAddress(device).then((mac) => {

								macAddress = mac;

							}, () => {

								// do nothing on rejection

							}).finally(() => {

								self.stopSpin();
								console.log(
									chalk.cyan('!'),
									"The Photon supports secure Wi-Fi setup. We'll try that."
								);
								return wireless.list(macAddress, self.options.manual);
							});

						});
					} else {
						tryScan();
					}
				});
			} else if (device.type === 'Electron') {
				detectedPrompt(device.type, function setupElectronChoice(ans) {
					if (ans.setup) {
						return self.setupElectron(device);
					}
					goodbye();
				});
			}
		}

		function detectedPrompt(name, cb) {

			console.log(
				arrow,
				'I have detected a',
				chalk.cyan(name),
				'connected via USB.'
			);

			self.prompt([{

				type: 'confirm',
				name: 'setup',
				message: 'Would you like to continue with this one?',
				default: true

			}]).then(cb);

		}
	}

	setupCore(device) {
		const self = this;
		const serial = this.command('serial');

		function promptForCyan() {
			return self.prompt([{
				type: 'input',
				name: 'online',
				message: 'Press ' + chalk.bold.cyan('ENTER') + ' when your core is breathing ' + chalk.bold.cyan('CYAN'),
			}]);
		}

		function promptForListen() {
			const question = {
				type: 'confirm',
				name: 'listen',
				message: 'Is your core blinking ' + chalk.bold.blue('BLUE'),
				default: true
			};

			return self.prompt([question])
				.then((answer) => {
					if (answer.listen) {
						console.log('Great! Lets give this another try...');
					} else {
						console.log();
						console.log(alert, 'Hold the', chalk.bold.cyan('MODE'), 'button for a couple seconds, until it starts blinking', chalk.bold.blue('BLUE'));
						console.log();
					}
				});
		}

		let deviceId;
		let deviceName;
		Promise.resolve()
			.then(() => {
				return retryDeferred(() => serial.askForDeviceID(device), 3, promptForListen);
			})
			.then((id) => {
				deviceId = id;
				return serial.configureWifi(device.port);
			})
			.then(() => promptForCyan())
			.then(() => {
				self.newSpin('Claiming the core to your account').start();
				return retryDeferred(() => self.api.claimDevice(deviceId), 3, promptForCyan);
			})
			.then(() => {
				self.stopSpin();
				return self.api.signalDevice(deviceId, true);
			})
			.then(() => self.prompt([{
				type: 'input',
				name: 'rainbows',
				message: 'Press ' + chalk.bold.cyan('ENTER') + ' when your core is excitedly shouting rainbows',
			}]))
			.then(() => {
				const question = {
					type: 'input',
					name: 'coreName',
					message: 'What would you like to call your core?'
				};

				return self.prompt([question])
					.then((ans) => {
						deviceName = ans.coreName;
						return self.api.signalDevice(deviceId, false)
							.then(() => self.api.renameDevice(deviceId, deviceName));
					});
			})
			.then(() => {
				console.log();
				console.log(util.format("You've successfully setup your core %s (%s)", deviceName, deviceId));
				console.log('Nice work!');
			})
			.catch((err) => {
				self.stopSpin();
				console.error(alert, 'Something went wrong');
				console.error(alert, err);
			});
	}

	setupElectron() {
		console.log();
		console.log(alert, 'Electron(s) cannot be setup via the CLI.');
		console.log();
		console.log(alert, 'We need to collect billing information, which we cannot do securely via the command line.');
		console.log(alert, 'Please visit', chalk.bold.cyan('https://setup.particle.io'), 'to setup your Electron.');
		process.exit(0);
	}

	prompt(prompts) {
		let handler = (result) => result;

		if (this.options.yes) {
			const newPrompts = [];
			const answers = {};

			for (let i = 0; i < prompts.length; i++) {
				const p = prompts[i];
				if (p.type !== 'confirm' || p.default !== true) {
					newPrompts.push(p);
				} else {
					answers[p.name] = true;
				}
			}

			handler = (ans) => {
				ans = Object.assign({}, ans, answers);
				return ans;
			};

			prompts = newPrompts;
		}

		return prompt(prompts).then(handler);
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

