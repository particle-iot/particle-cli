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

	if(shortcut == 'wifi') {

		//TODO: serial Wi-Fi configuration (Core)
	}

	console.log(chalk.bold.cyan(utilities.banner()));
	console.log(arrow, "Setup is easy! Let's get started...");

	loginCheck();

	function loginCheck() {

		if(settings.username) {

			self.__wasLoggedIn = true;
			return promptSwitch();
		}

		// not logged in, go signup/login.
		accountStatus(false);
	};

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
	};

	function switchChoice(ans) {

		// user wants to logout
		if(ans.switch) {

			// TODO: Actually log user out
			console.log(
				arrow,
				util.format('You have been logged out from %s.',
				chalk.bold.cyan(settings.username))
			);

			return prompt([{

				type: 'confirm',
				name: 'wipe',
				message: strings.revokeAuthPrompt,
				default: false

			}], wipeChoice);
		}

		// user has remained logged in
		accountStatus(true);
	};

	function wipeChoice(ans) {

		if(ans.wipe) {

			// TODO: Actually revoke authentication
			console.log(arrow, 'Authentication token revoked!');
		}
		else {

			console.log(arrow, 'Leaving your token intact.');
		}

		accountStatus(false);
	};

	function accountStatus(alreadyLoggedIn) {

		if(!alreadyLoggedIn) {

			// New user!
			if(!self.__wasLoggedIn) { return self.signup(self.findDevice.bind(self)); }
			// Not-new user!
			return self.login(self.findDevice.bind(self));
		}

		self.findDevice.call(self);
	};
};


SetupCommand.prototype.signup = function signup(cb, tries) {

	if(!tries) { var tries = 1; }
	else if(tries && tries > 3) {

		console.log(alert, "Something is going wrong with the signup process.");
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
		default: signupUsername

	}, {

		type: 'password',
		name: 'password',
		message: 'Please enter a secure password:'

	}, {

		type: 'password',
		name: 'confirm',
		message: 'Please confirm your password:'

	}], signupInput);

	function signupInput(ans) {
		console.log(ans)
		if(!ans.username) {

			console.log(alert, 'You need an email address to sign up, silly!');
			return self.login(cb, ++tries);
		}
		if(!ans.password) {

			console.log(alert, 'You need a password to sign up, silly!');
			return self.login(cb, ++tries);
		}
		if(!ans.confirm || ans.confirm !== ans.password) {

			// try to remember username to save them some frustration
			if(ans.username) {

				self.__signupUsername = ans.username
			}
			console.log(
				arrow,
				"Sorry, those passwords didn't match. Let's try again!"
			);
			return self.login(cb, ++tries);
		}

		// TODO: actually send API signup request
		console.log(arrow, strings.signupSuccess);
		cb(null);
	}
};

SetupCommand.prototype.login = function login(cb, tries) {

	var self = this;

	if(!tries) { var tries = 1; }
	else if(tries && tries > 3) {

		console.log(alert, "It seems we're having trouble with logging in.");
		return console.log(
			alert,
			util.format(strings.helpForMoreInfo,
			chalk.bold.cyan(cmd))
		);
	}
	console.log(arrow, "Let's get you logged in!");

	prompt([{

		type: 'input',
		name: 'username',
		message: 'Please enter your email address:'

	}, {

		type: 'password',
		name: 'password',
		message: 'Please enter your password:'

	}], loginInput);

	function loginInput(ans) {

		if(!ans.username) {

			console.log(arrow, "You need an email address to log in, silly!");
			return login(cb, ++tries);
		}
		if(!ans.password) {

			console.log(arrow, "You need a password to log in, silly!");
			return login(cb, ++tries);
		}

		self.__api.login(
			settings.clientId,
			ans.username,
			ans.password,
			loggedIn
		);
	};

	function loggedIn(err, dat) {

		if(err) {

			console.log(alert, strings.loginError);
			console.error(err);
			return login(cb, ++tries);
		}

		console.log(arrow, 'Successfully completed login!');
		cb(null, dat);
	};
};

SetupCommand.prototype.findDevice = function() {

	var self = this;
	var serial = this.cli.getCommandModule('serial');
	var wireless = this.cli.getCommandModule('wireless');

	console.log();
	console.log(
		chalk.cyan('!'),
		"PROTIP:",
		chalk.grey('Hold the'),
		chalk.cyan('MODE/SETUP'),
		chalk.grey('button on your device until it'),
		chalk.cyan('blinks blue!')
	);

	console.log(
		chalk.cyan('!'),
		"PROTIP:",
		chalk.grey('Please make sure you are'),
		chalk.cyan('connected'),
		chalk.grey('to the'),
		chalk.cyan('internet.'),
		"\n"
	);
	this.newSpin('Now to find your device(s)...').start();

	serial.findCores(function found(cores) {

		self.stopSpin();

		if(cores.length > 0) { return cores.forEach(inspect, self); }
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

	function inspect(core) {

		console.log(core);
		// TODO: Update deviceSpecs to include DFU & non-DFU PIDs, use here
		if(core.productId == 0x607d) {

			detectedPrompt("Spark Core", setupCoreChoice);

			function setupCoreChoice(ans) {

				if(ans.setup) {

					// TODO: setup core via serial
					return;
				}
				// TODO: Offer to do something else. Photon setup?
			};
		}
		else if(core.productId == 0xc006) {

			// Photon detected
			detectedPrompt("Photon", setupPhotonChoice);
			function setupPhotonChoice(ans) {

				// TODO: figure out Photon AP name via USB?

				if(ans.setup) {
					console.log(
						chalk.cyan('!'),
						"First let's try secure Wi-Fi setup."
					);
					return wireless.list();
				}
				console.log(arrow, "Goodbye!");
			}
		}
	};

	function detectedPrompt(name, cb) {

		console.log(
			arrow,
			"I have detected a",
			chalk.cyan(name),
			"connected via USB."
		);

		prompt([{

			type: 'confirm',
			name: 'setup',
			message: 'Would you like to continue with this one?',
			default: true

		}], cb);

	};
};

SetupCommand.prototype.checkArguments = function(args) {

	this.options = this.options || { };

	// TODO: tryParseArgs?
	if (!this.options.scan) {

		this.options.scan = utilities.tryParseArgs(
			args,
			"--scan",
			null
		);
	}
};

// TODO: DRY this up somehow

var cmd = path.basename(process.argv[1]);
var alert = chalk.yellow('!');
var arrow = chalk.green('>');

module.exports = SetupCommand;
