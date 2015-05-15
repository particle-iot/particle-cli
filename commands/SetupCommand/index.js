'use strict';

var chalk = require('chalk');
var prompt = require('inquirer').prompt;
var ApiClient2 = require('../../lib/Apiclient2');

var settings = require('../../settings.js');
var BaseCommand = require("../BaseCommand.js");
var dfu = require('../../lib/dfu.js');
var specs = require('../../lib/deviceSpecs');
var prompts = require('../../lib/prompts.js');
var ApiClient = require('../../lib/ApiClient.js');
var utilities = require('../../lib/utilities.js');

var when = require('when');
var sequence = require('when/sequence');
var pipeline = require('when/pipeline');
var readline = require('readline');
var fs = require('fs');
var util = require('util');
var path = require('path');
var extend = require('xtend');


// this is mainly so we only break 80 columns in one place.
var strings = {

	'description': "Helps guide you through the initial setup & claiming of your device",
	'alreadyLoggedIn': "It appears as though you are already logged in as %s",
	'revokeAuthPrompt': "Would you like to revoke the current authentication token?",
	'signupSuccess': "Great success! You're now the owner of a brand new account!",
	'loginError': "There was an error logging you in! Let's try again.",
	'helpForMoreInfo': "Please try the `%s help` command for more information."
};

var SetupCommand = function (cli, options) {

	SetupCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);
	this.__wasLoggedIn;
	this.__api = new ApiClient2(settings.apiUrl, settings.access_token);
	this.__oldapi = new ApiClient(settings.apiUrl, settings.access_token);
	this.init();
};

util.inherits(SetupCommand, BaseCommand);

SetupCommand.prototype.name = "setup";
SetupCommand.prototype.options = null;
SetupCommand.prototype.description = strings.description;
SetupCommand.prototype.init = function init() {

	this.addOption("*",
		this.setup.bind(this),
		this.description
	);
};

SetupCommand.prototype.setup = function setup(shortcut) {

	var self = this;
	var wireless = this.cli.getCommandModule('wireless');
	var serial = this.cli.getCommandModule('serial');
	var cloud = this.cli.getCommandModule('cloud');
	var coreName;
	var coreID;

	this.checkArguments(arguments);

	if(shortcut === 'wifi') {
		return serial.configureWifi();
	}

	console.log(chalk.bold.cyan(utilities.banner()));
	console.log(arrow, "Setup is easy! Let's get started...");

	loginCheck();

	function loginCheck() {
		self.__wasLoggedIn = !!settings.username;

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

		prompt([{

			type: 'confirm',
			name: 'switch',
			message: 'Would you like to log in with a different account?',
			default: false

		}], switchChoice);
	}

	function switchChoice(ans) {
		// user wants to logout
		if (ans.switch) {
			cloud.logout().then(function() {
				self.__api.clearToken();
				self.__oldapi.clearToken();
				accountStatus(false);
			});
		} else {
			// user has remained logged in
			accountStatus(true);
		}
	}

	function accountStatus(alreadyLoggedIn) {
		if (!alreadyLoggedIn) {
			// New user or a fresh environment!
			if (!self.__wasLoggedIn) {
				prompt([
					{
						type: 'list',
						name: 'login',
						message: 'Hello Stranger! This seems to be your first time here. What would you like to do?',
						choices: [
							{ name: 'Create a new account', value: false },
							{ name: 'Login', value: true }
						]
					}
				], function(answers) {
					if (answers.login) {
						return self.login(self.findDevice.bind(self));
					}
					return self.signup(self.findDevice.bind(self));
				});

				return;
			}

			// Not-new user!
			return self.login(self.findDevice.bind(self));
		}

		self.findDevice.call(self);
	}
};


SetupCommand.prototype.signup = function signup(cb, tries) {
	if(!tries) { var tries = 1; }
	else if(tries && tries > 3) {

		console.log(alert, 'Something is going wrong with the signup process.');
		return console.log(
			alert,
			util.format(strings.helpForMoreInfo,
			chalk.bold.cyan(cmd))
		);
	}
	var self = this;
	var signupUsername = this.__signupUsername || undefined;
	console.log(arrow, "Let's create your new account!");

	prompt([{

		type: 'input',
		name: 'username',
		message: 'Please enter a valid email address:',
		default: signupUsername,
		validate: function(value) {
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
		validate: function(value) {
			if (!value) {
				return "I'm afraid your password cannot be empty. Try again.";
			}
			return true;
		}
	}, {

		type: 'password',
		name: 'confirm',
		message: 'Please confirm your password:',
		validate: function(value) {
			if (!value) {
				return "I'm afraid your password cannot be empty. Try again.";
			}
			return true;
		}

	}], signupInput);

	function signupInput(ans) {
		if (ans.confirm !== ans.password) {

			// try to remember username to save them some frustration
			if (ans.username) {
				self.__signupUsername = ans.username;
			}
			console.log(
				arrow,
				"Sorry, those passwords didn't match. Let's try again!"
			);
			return self.signup(cb, ++tries);
		}

		self.__api.createUser(ans.username, ans.password, function (signupErr) {
			if (signupErr) {
				console.error(signupErr);
				console.error(alert, "Oops, that didn't seem to work. Let's try that again");
				return self.signup(cb, ++tries);
			}

			// Login the new user automatically
			self.__api.login(settings.clientId, ans.username, ans.password, function (loginErr, body) {
				// if just the login fails, reset to the login part of the setup flow
				if (loginErr) {
					console.error(loginErr);
					console.error(alert, 'We had a problem logging you in :(');
					return self.login(cb);
				}

				self.__oldapi.updateToken(body.access_token);

				settings.override(null, 'username', ans.username);
				console.log(arrow, strings.signupSuccess);
				cb(null);
			});
		});

	}
};

SetupCommand.prototype.login = function login(cb) {
	var self = this;
	var cloud = this.cli.getCommandModule('cloud');

	console.log(arrow, "Let's get you logged in!");

	cloud.login().then(function (accessToken) {
		self.__api.updateToken(accessToken);
		self.__oldapi.updateToken(accessToken);
		cb();
	}).catch(function() {
		return;
	});
};

SetupCommand.prototype.findDevice = function() {

	var self = this;
	var serial = this.cli.getCommandModule('serial');
	var wireless = this.cli.getCommandModule('wireless');

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

	serial.findDevices(function found(devices) {

		self.stopSpin();

		if(devices.length > 0) {
			if(devices.length > 1) {

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

		prompt([{

			type: 'confirm',
			name: 'scan',
			message: 'Would you like to scan for nearby Photons in Wi-Fi setup mode?',
			default: true

		}], scanChoice);

		function scanChoice(ans) {

			if(ans.scan) { return wireless.list(); }
			console.log(arrow, 'Goodbye!');
		};
	});

	function inspect(device) {

		// TODO: Update deviceSpecs to include DFU & non-DFU PIDs, use here
		if(device.type === 'Spark Core') {

			detectedPrompt('Spark Core', function setupCoreChoice(ans) {

				if(ans.setup) {
					return self.setupCore(device);
				}
				console.log(arrow, 'Goodbye!');
			});
		} else if(device.type === 'Photon') {

			// Photon detected
			detectedPrompt('Photon', function setupPhotonChoice(ans) {

				if(ans.setup) {

					var macAddress;
					self.newSpin('Getting device information...').start();
					serial.getDeviceMacAddress(device).then(function(mac) {

						macAddress = mac;

					}, function() {

						// do nothing on rejection

					}).finally(function () {

						self.stopSpin();
						console.log(
							chalk.cyan('!'),
							"The Photon supports secure Wi-Fi setup. We'll try that first."
						);
						return wireless.list(macAddress);
					});
					return;
				}
				console.log(arrow, 'Goodbye!');
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

		prompt([{

			type: 'confirm',
			name: 'setup',
			message: 'Would you like to continue with this one?',
			default: true

		}], cb);

	}
};

SetupCommand.prototype.setupCore = function(device) {
	var self = this;
	var serial = this.cli.getCommandModule('serial');

	function promptForCyan() {
		var online = when.defer();
		prompt([
			{
				type: 'input',
				name: 'online',
				message: 'Press ' + chalk.bold.cyan('ENTER') + ' when your core is breathing ' + chalk.bold.cyan('CYAN'),
			}
		], function() {
			online.resolve();
		});
		return online.promise;
	}

	function promptForListen() {
		var listen = when.defer();
		prompt([
			{
				type: 'confirm',
				name: 'listen',
				message: 'Is your core blinking ' + chalk.bold.blue('BLUE'),
				default: true
			}
		], function(answer) {
			if (answer.listen) {
				console.log('Great! Lets give this another try...');
			} else {
				console.log();
				console.log(alert, 'Hold the', chalk.bold.cyan('MODE'), 'button for a couple seconds, until it starts blinking', chalk.bold.blue('BLUE'));
				console.log();
			}
			listen.resolve();
		});
		return listen.promise;
	}

	var deviceId;
	var deviceName;
	pipeline([
		function () {
			return utilities.retryDeferred(function () {
				return serial.askForDeviceID(device);
			}, 3, promptForListen);
		},
		function(id) {
			deviceId = id;
			return serial.configureWifi(device.port);
		},
		function() {
			return promptForCyan();
		},
		function() {
			self.newSpin('Claiming the core to your account').start();
			return utilities.retryDeferred(function () {
				return self.__oldapi.claimCore(deviceId);
			}, 3, promptForCyan);
		},
		function() {
			self.stopSpin();
			return self.__oldapi.signalCore(deviceId, true);
		},
		function() {
			var rainbow = when.defer();
			prompt([
				{
					type: 'input',
					name: 'rainbows',
					message: 'Press ' + chalk.bold.cyan('ENTER') + ' when your core is excitedly shouting rainbows',
				}
			], function() {
				rainbow.resolve();
			});
			return rainbow.promise;
		},
		function() {
			var naming = when.defer();
			prompt([
				{
					type: 'input',
					name: 'coreName',
					message: 'What would you like to call your core?'
				}
			], function(ans) {
				deviceName = ans.coreName;
				sequence([
					function() {
						return self.__oldapi.signalCore(deviceId, false);
					},
					function() {
						return self.__oldapi.renameCore(deviceId, deviceName);
					}
				]).then(naming.resolve, naming.reject);
			});
			return naming.promise;
		}
	]).then(function() {
		console.log();
		console.log(util.format("You've successfully setup your core %s (%s)", deviceName, deviceId));
		console.log('Nice work!');
	}, function(err) {
		self.stopSpin();
		console.error(alert, 'Something went wrong');
		console.error(alert, err);
	});
};

SetupCommand.prototype.checkArguments = function(args) {

	this.options = this.options || { };

	// TODO: tryParseArgs?
	if (!this.options.scan) {

		this.options.scan = utilities.tryParseArgs(
			args,
			'--scan',
			null
		);
	}
};

// TODO: DRY this up somehow

var cmd = path.basename(process.argv[1]);
var alert = chalk.yellow('!');
var arrow = chalk.green('>');

module.exports = SetupCommand;
