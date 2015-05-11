/**
 ******************************************************************************
 * @file    commands/CloudCommands.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Cloud commands module
 ******************************************************************************
Copyright (c) 2014 Spark Labs, Inc.  All rights reserved.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */

var when = require('when');
var sequence = require('when/sequence');
var pipeline = require('when/pipeline');

var readline = require('readline');
var SerialPortLib = require("serialport");
var SerialPort = SerialPortLib.SerialPort;
var settings = require('../settings.js');
var BaseCommand = require("./BaseCommand.js");
var prompts = require('../lib/prompts.js');
var ApiClient = require('../lib/ApiClient.js');
var utilities = require('../lib/utilities.js');

var fs = require('fs');
var path = require('path');
var moment = require('moment');
var extend = require('xtend');
var util = require('util');
var chalk = require('chalk');
var inquirer = require('inquirer');

var arrow = chalk.green('>');
var alert = chalk.yellow('!');
var cmd = path.basename(process.argv[1]);

var CloudCommand = function (cli, options) {
	CloudCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(CloudCommand, BaseCommand);
CloudCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "cloud",
	description: "simple interface for common cloud functions",


	init: function () {
		this.addOption("claim", this.claimCore.bind(this), "Register a core with your user account with the cloud");
		this.addOption("list", this.listDevices.bind(this), "Displays a list of your devices, as well as their variables and functions");
		this.addOption("remove", this.removeCore.bind(this), "Release a core from your account so that another user may claim it");
		this.addOption("name", this.nameCore.bind(this), "Give a core a name!");
		this.addOption("flash", this.flashCore.bind(this), "Pass a binary, source file, or source directory to a core!");
		this.addOption("compile", this.compileCode.bind(this), "Compile a source file, or directory using the cloud service");
		//this.addOption("binary", this.downloadBinary.bind(this), "Compile a source file, or directory using the cloud service");

		this.addOption("nyan", this.nyanMode.bind(this), "How long has this been here?");

		this.addOption("login", this.login.bind(this), "Lets you login to the cloud and stores an access token locally");
		this.addOption("logout", this.logout.bind(this), "Logs out your session and clears your saved access token");
	},


	usagesByName: {
		nyan: [
			"spark cloud nyan",
			"spark cloud nyan my_core_id on",
			"spark cloud nyan my_core_id off",
			"spark cloud nyan all on"
		]

	},


	checkArguments: function (args) {
		this.options = this.options || {};

		if (!this.options.saveBinaryPath && (utilities.contains(args, "--saveTo"))) {
			var idx = utilities.indexOf(args, "--saveTo");
			if ((idx + 1) < args.length) {
				this.options.saveBinaryPath = args[idx + 1];
			}
			else {
				console.log("Please specify a file path when using --saveTo");
			}
		}
	},

	claimCore: function (coreid) {
		if (!coreid) {
			console.error("Please specify a coreid");
			return;
		}

		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return;
		}
		console.log("Claiming core " + coreid);
		api.claimCore(coreid);
	},

	removeCore: function (coreid) {
		if (!coreid) {
			console.error("Please specify a coreid");
			return when.reject()
		}

		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return;
		}

		when(prompts.areYouSure())
			.then(function (yup) {
				api.removeCore(coreid).then(function () {
						console.log("Okay!");
						process.exit(0);
					},
					function (err) {
						console.log("Didn't remove the core " + err);
						process.exit(1);
					});
			},
			function (err) {
				console.log("Didn't remove the core " + err);
				process.exit(1);
			});
	},

	nameCore: function (coreid, name) {
		if (!coreid) {
			console.error("Please specify a coreid");
			return when.reject();
		}

		if (!name) {
			console.error("Please specify a name");
			return;
		}

		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return;
		}

		console.log("Renaming core " + coreid);
		api.renameCore(coreid, name);
	},

	flashCore: function (coreid, filePath) {
		if (!coreid) {
			console.error("Please specify a coreid");
			return when.reject();
		}

		if (!filePath) {
			console.error("Please specify a binary file, source file, or source directory, or known app");
			return when.reject();
		}

		var files = null;

		if (!fs.existsSync(filePath)) {
			if (settings.knownApps[filePath]) {
				files = { file: settings.knownApps[filePath] };
			}
			else {
				console.error("I couldn't find that: " + filePath);
				return when.reject();
			}
		}

		//make a copy of the arguments sans the 'coreid'
		var args = Array.prototype.slice.call(arguments, 1);

		if (!files) {
			files = this._handleMultiFileArgs(args);
		}
		if (!files) {
			return -1;
		}
		if (!files["file"]) {
			console.error("no files included?");
		}
		if (settings.showIncludedSourceFiles) {
			console.log("Including:");
			for (var key in files) {
				console.log("    " + files[key]);
			}
		}

		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return -1;
		}

		return api.flashCore(coreid, files);
	},

	/**
	 * use application ID instead of binary ID
	 * @param binary_id
	 * @param filename
	 */
	downloadBinary: function (binary_id, filename) {
		if (!filename) {
			filename = "firmware_" + (new Date()).getTime() + ".bin";
		}

		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return;
		}


		var binary_url = "/v1/binaries/" + binary_id;
		var allDone = api.downloadBinary(binary_url, filename);

		when(allDone).then(
			function () {
				console.log("saved firmware to " + path.resolve(filename));
				console.log("Firmware Binary downloaded.");
			},
			function (err) {
				console.error("Download failed - ", err);
			});

	},

	compileCode: function () {
		//  "Please specify a binary file, source file, or source directory");

		var args = Array.prototype.slice.call(arguments, 0);
		if (args.length == 0) {
			args.push("."); //default to current directory
		}

		var filePath = args[0];
		if (!fs.existsSync(filePath)) {
			console.error("I couldn't find that: " + filePath);
			return process.exit(1);
		}

		this.checkArguments(arguments);

		//make a copy of the arguments
		var files = this._handleMultiFileArgs(args);
		if (!files) {
			return;
		}

		if (settings.showIncludedSourceFiles) {
			console.log("Including:");
			for (var key in files) {
				console.log("    " + files[key]);
			}
		}

		var filename;
		if (this.options.saveBinaryPath) {
			filename = this.options.saveBinaryPath;
		}
		else {
			//grab the last filename
			filename = (arguments.length > 1) ? arguments[arguments.length - 1] : null;

			//if it's empty, or it doesn't end in .bin, lets assume it's not an output file.
			//NOTE: because of the nature of 'options at the end', and the only option is --saveTo,
			//this should have no side-effects with other usages.  If we did a more sophisticated
			//argument structure, we'd need to change this logic.
			if (!filename || (utilities.getFilenameExt(filename) != ".bin")) {
				filename = "firmware_" + (new Date()).getTime() + ".bin";
			}
		}


		var that = this;
		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return;
		}

		var allDone = pipeline([
			//compile
			function () {
				return api.compileCode(files);
			},

			//download
			function (resp) {

				if (resp && resp.sizeInfo) {
					//TODO: needs formatting
					console.log("Memory use: ");
					console.log(resp.sizeInfo);
				}


				if (resp && resp.binary_url) {
					return api.downloadBinary(resp.binary_url, filename);
				}
				else {
					if (resp.errors) {
						console.log("Errors");
						console.log(resp.errors.join("\n"));
					}
					return when.reject("compile failed ");
				}
			}
		]);

		when(allDone).then(
			function () {
				console.log("saved firmware to " + path.resolve(filename));
				console.log("Compiled firmware downloaded.");
			},
			function (err) {
				console.error("Compile failed - ", err);
			});

	},

	login: function () {
		var self = this;
		var username = null;

		if (this.tries >= 3) {
			console.log();
			console.log(alert, "It seems we're having trouble with logging in.");
			console.log(
				alert,
				util.format('Please try the `%s help` command for more information.',
					chalk.bold.cyan(cmd))
			);
			return when.reject();
		}

		var allDone = pipeline([
			//prompt for creds
			prompts.getCredentials,

			//login to the server
			function (creds) {
				var api = new ApiClient(settings.apiUrl);
				username = creds.username;
				return api.login(settings.clientId, creds.username, creds.password);
			},

			function (accessToken) {
				console.log(arrow, 'Successfully completed login!');
				settings.override(null, 'access_token', accessToken);
				if (username) {
					settings.override(null, 'username', username);
				}
				self.tries = 0;
			}
		]);

		return when(allDone).catch(function (err) {
			console.log(alert, "There was an error logging you in! Let's try again.");
			console.error(alert, err);
			self.tries = (self.tries || 0) + 1;

			return self.login();
		});
	},

	logout: function () {
		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!settings.access_token) {
			console.log('You were already logged out.');
			return when.resolve();
		}

		var allDone = when.defer();

		inquirer.prompt([
			{
				type: 'confirm',
				name: 'wipe',
				message: 'Would you like to revoke the current authentication token?',
				default: false
			},
			{
				type: 'password',
				name: 'password',
				message: 'Please enter your password',
				when: function(ans) { return ans.wipe; }
			}
		], function(answers) {
			pipeline([
				function() {
					if (answers.wipe) {
						return api.removeAccessToken(settings.username, answers.password, settings.access_token);
					} else {
						console.log(arrow, 'Leaving your token intact.');
					}
				},
				function() {
					console.log(
						arrow,
						util.format('You have been logged out from %s.',
						chalk.bold.cyan(settings.username))
					);
					settings.override(null, 'username', null);
					settings.override(null, 'access_token', null);
				}
			]).then(function() {
				allDone.resolve();
			}, function(err) {
				allDone.reject(err);
			});
		});

		return allDone.promise;
	},


	getAllDeviceAttributes: function (args) {
		console.error("Checking with the cloud...");
		var self = this;

		var tmp = when.defer();
		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return when.reject("not logged in!");
		}

		var lookupVariables = function (devices) {
			if (!devices || (devices.length === 0) || (typeof devices === "string")) {
				console.log("No devices found.");
			}
			else {
				self.newSpin('Retrieving device functions and variables...').start();
				var promises = [];
				devices.forEach(function (device) {
					if (!device.id) {
						return;
					}

					if (device.connected) {
						promises.push(api.getAttributes(device.id).then(function(attrs) {
							return extend(device, attrs);
						}));
					}
					else {
						promises.push(when.resolve(device));
					}
				});

				when.all(promises).then(function (fullDevices) {
					//sort alphabetically
					fullDevices = fullDevices.sort(function (a, b) {
						if (a.connected && !b.connected) {
							return 1;
						}

						return (a.name || "").localeCompare(b.name);
					});
					tmp.resolve(fullDevices);
					self.stopSpin();
				});
			}
		};

		pipeline([
			api.listDevices.bind(api),
			lookupVariables
		]);

		return tmp.promise;
	},


	nyanMode: function(coreID, onOff) {


		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return when.reject("not logged in!");
		}

		if (!onOff || (onOff == "") || (onOff == "on")) {
			onOff = true;
		}
		else if (onOff == "off") {
			onOff = false;
		}

		if ((coreID == "") || (coreID == "all")) {
			coreID = null;
		}
		else if (coreID == "on") {
			coreID = null;
			onOff = true;
		}
		else if (coreID == "off") {
			coreID = null;
			onOff = false;
		}


		if (coreID) {
			api.signalCore(coreID, onOff);
		}
		else {

		   var toggleAll = function (cores) {
				if (!cores || (cores.length == 0)) {
					console.log("No cores found.");
				}
				else {
					var promises = [];
					for (var i = 0; i < cores.length; i++) {
						var coreid = cores[i].id;
						if (!cores[i].connected) {
							promises.push(when.resolve(cores[i]));
							continue;
						}

						promises.push(api.signalCore(coreid, onOff));
					}
					return when.all(promises);
				}
			};


			pipeline([
				api.listDevices.bind(api),
				toggleAll
			]);
		}
	},



	listDevices: function (args) {

		var formatVariables = function (vars, lines) {
			if (vars) {
				var arr = [];
				for (var key in vars) {
					var type = vars[key];
					arr.push("    " + key + " (" + type + ")");
				}

				if (arr.length > 0) {
					//TODO: better way to accomplish this?
					lines.push("  Variables:");
					for(var i=0;i<arr.length;i++) { lines.push(arr[i]); }
				}

			}
		};
		var formatFunctions = function (funcs, lines) {
			if (funcs && (funcs.length > 0)) {
				lines.push("  Functions:");

				for (var idx = 0; idx < funcs.length; idx++) {
					var name = funcs[idx];
					lines.push("    int " + name + "(String args) ");
				}
			}
		};


		when(this.getAllDeviceAttributes(args)).then(function (devices) {
			try {
				var lines = [];
				for (var i = 0; i < devices.length; i++) {
					var device = devices[i];

					var deviceType = '';
					switch(device.product_id) {
						case 0:
							deviceType = ' (Spark Core)';
							break;
						case 6:
							deviceType = ' (Photon)';
							break;
					}

					var status = device.name + " (" + device.id + ")" + deviceType + " is ";
					status += (device.connected) ? "online" : "offline";
					lines.push(status);

					formatVariables(device.variables, lines);
					formatFunctions(device.functions, lines);
				}

				console.log(lines.join("\n"));
			}
			catch (ex) {
				console.error("Error during list " + ex);
			}
		}, function(err) {
			console.log("Please make sure you're online and logged in.");
		});
	},

	/**
	 * helper function for getting the contents of a directory,
	 * checks for '.include', and a '.ignore' files, and uses their contents
	 * instead
	 * @param dirname
	 * @private
	 */
	_processDirIncludes: function (dirname) {
		dirname = path.resolve(dirname);

		var includesFile = path.join(dirname, settings.dirIncludeFilename),
			ignoreFile = path.join(dirname, settings.dirExcludeFilename),
			ignoreSet = {};

		var includes = [
			"*.h",
			"*.ino",
			"*.cpp",
			"*.c"
		];

		if (fs.existsSync(includesFile)) {
			//grab and process all the files in the include file.

			includes = utilities.trimBlankLinesAndComments(
				utilities.readAndTrimLines(includesFile)
			);
		}

		var files = utilities.globList(dirname, includes);
		if (fs.existsSync(ignoreFile)) {
			var ignores = utilities.trimBlankLinesAndComments(
				utilities.readAndTrimLines(ignoreFile)
			);

			var ignoredFiles = utilities.globList(dirname, ignores);
			files = utilities.compliment(files, ignoredFiles);
		}
		return files;
	},


	_handleMultiFileArgs: function (arr) {
		//use cases:
		// compile someDir
		// compile someFile
		// compile File1 File2 File3 output.bin
		// compile File1 File2 File3 --saveTo anotherPlace.bin

		if (!arr || arr.length == 0) {
			return null;
		}

		var filelist = [];

		var files = {};
		var filePath = arr[0];
		var stats = fs.statSync(filePath);

		if (stats.isDirectory()) {
			filelist = this._processDirIncludes(filePath);
			if (!filelist) {
				console.log("Your " + settings.dirIncludeFilename + " file is empty, not including anything!");
				return null;
			}
		}
		else if (stats.isFile()) {
			filelist = arr;
		}
		else {
			console.log("was that a file or directory?");
			return null;
		}

		for (var i = 0; i < filelist.length; i++) {
			var filename = filelist[i];
			var ext = utilities.getFilenameExt(filename).toLowerCase();
			var alwaysIncludeThisFile = ((ext == ".bin") && (i == 0) && (filelist.length == 1));

			if (filename.indexOf("--") == 0) {
				//hit some arguments.
				break;
			}

			if (!alwaysIncludeThisFile
				&& utilities.contains(settings.notSourceExtensions, ext)) {
				continue;
			}

			if (!fs.existsSync(filename)) {
				console.error("I couldn't find the file " + filename);
				return null;
			}

			var filestats = fs.statSync(filename);
			if (filestats.size > settings.MAX_FILE_SIZE) {
				console.log("Skipping " + filename + " it's too big! " + stats.size);
				continue;
			}

			if (i == 0) {
				files['file'] = filename;
			}
			else {
				files['file' + i] = filename;
			}
		}

		return files;
	},


	_: null
});

module.exports = CloudCommand;
