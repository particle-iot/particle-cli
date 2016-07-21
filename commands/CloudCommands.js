/**
 ******************************************************************************
 * @file    commands/CloudCommands.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Cloud commands module
 ******************************************************************************
Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

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
'use strict';

var _ = require('lodash');
var when = require('when');
var whenNode = require('when/node');
var pipeline = require('when/pipeline');
var prompt = require('inquirer').prompt;
var temp = require('temp').track();

var settings = require('../settings.js');
var specs = require('../oldlib/deviceSpecs');
var BaseCommand = require('./BaseCommand.js');
var prompts = require('../oldlib/prompts.js');
var ApiClient = require('../oldlib/ApiClient.js');
var utilities = require('../oldlib/utilities.js');

var fs = require('fs');
var path = require('path');
var extend = require('xtend');
var util = require('util');
var chalk = require('chalk');
var inquirer = require('inquirer');

var arrow = chalk.green('>');
var alert = chalk.yellow('!');
var cmd = path.basename(process.argv[1]);

// Use known platforms and add shortcuts
var PLATFORMS = extend(utilities.knownPlatforms(), {
	'c': 0,
	'p': 6,
	'e': 10,
	'o': 82,
	'd': 88,
	'b': 103,
	'bg': 269,
	'bb': 270
});

var CloudCommand = function (cli, options) {
	CloudCommand.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(CloudCommand, BaseCommand);
CloudCommand.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: 'cloud',
	description: 'simple interface for common cloud functions',


	init: function () {
		this.addOption('claim', this.claimDevice.bind(this), 'Register a device with your user account with the cloud');
		this.addOption('list', this.listDevices.bind(this), 'Displays a list of your devices, as well as their variables and functions');
		this.addOption('remove', this.removeDevice.bind(this), 'Release a device from your account so that another user may claim it');
		this.addOption('name', this.nameDevice.bind(this), 'Give a device a name!');
		this.addOption('flash', this.flashDevice.bind(this), 'Pass a binary, source file, or source directory to a device!');
		this.addOption('compile', this.compileCode.bind(this), 'Compile a source file, or directory using the cloud service');

		this.addOption('nyan', this.nyanMode.bind(this), 'How long has this been here?');

		this.addOption('login', this.login.bind(this), 'Lets you login to the cloud and stores an access token locally');
		this.addOption('logout', this.logout.bind(this), 'Logs out your session and clears your saved access token');
	},


	usagesByName: {
		nyan: [
			'particle cloud nyan',
			'particle cloud nyan my_device_id on',
			'particle cloud nyan my_device_id off',
			'particle cloud nyan all on'
		]

	},


	checkArguments: function (args) {
		this.options = this.options || {};

		if (!this.options.saveBinaryPath && (utilities.contains(args, '--saveTo'))) {
			var idx = utilities.indexOf(args, '--saveTo');
			if ((idx + 1) < args.length) {
				this.options.saveBinaryPath = args[idx + 1];
			} else {
				console.log('Please specify a file path when using --saveTo');
			}
		}
		if (!this.options.target) {
			this.options.target = utilities.tryParseArgs(args,
				'--target',
				null
			);
		}
		if (!this.options.local) {
			// todo - move args parsing to a dedicated portion of the command interface (bound to I/O, and separate
			// from the main command logic.)
			var idx = utilities.indexOf(args, '--local');
			this.options.local = idx>=0;
		}
		if (!this.options.verbose) {
			var idx = utilities.indexOf(args, '--verbose')
			this.options.verbose = idx>=0;
		}
	},

	claimDevice: function (deviceid) {
		if (!deviceid) {
			console.error('Please specify a device id');
			return -1;
		}

		var api = new ApiClient();
		if (!api.ready()) {
			return -1;
		}
		console.log('Claiming device ' + deviceid);
		return api.claimDevice(deviceid).then(function() {
			console.log('Successfully claimed device ' + deviceid);
		}, function(err) {
			if (err && err.indexOf('That belongs to someone else.') >= 0) {
				return when.promise(function(resolve, reject) {
					prompt([{
						type: 'confirm',
						name: 'transfer',
						message: 'That device belongs to someone else. Would you like to request a transfer?',
						default: true
					}], function(ans) {
						if (ans.transfer) {
							return api.claimDevice(deviceid, true).then(function(body) {
								console.log('Transfer #' + body.transfer_id + ' requested. You will receive an email if your transfer is approved or denied.');
								resolve();
							}, reject);
						}
						reject('You cannot claim a device owned by someone else');
					});
				});
			}
			return when.reject(err);
		}).catch(function(err) {
			console.log('Failed to claim device, server said:', err);
			return when.reject(err);
		});
	},

	removeDevice: function (deviceid) {
		if (!deviceid) {
			console.error('Please specify a device id');
			return when.reject();
		}

		var api = new ApiClient();
		if (!api.ready()) {
			return -1;
		}

		return prompts.areYouSure()
			.then(function () {
				return api.removeDevice(deviceid).then(function () {
					console.log('Okay!');
				});
			}).catch(function (err) {
				console.log("Didn't remove the device " + err);
				return when.reject();
			});
	},

	nameDevice: function (deviceid, name) {
		if (!deviceid) {
			console.error('Please specify a device id');
			return when.reject();
		}

		if (!name) {
			console.error('Please specify a name');
			return -1;
		}

		if (arguments.length > 2) {
			console.error('Device names cannot contain spaces');
			return -1;
		}

		var api = new ApiClient();
		if (!api.ready()) {
			return -1;
		}

		console.log('Renaming device ' + deviceid);

		var allDone = api.renameDevice(deviceid, name);

		when(allDone).then(
			function () {
				console.log('Successfully renamed device ' + deviceid + ' to: ' + name);
			},
			function (err) {
				if (err.info.indexOf('I didn\'t recognize that device name or ID') >= 0) {
					console.error('Device ' + deviceid + ' not found.');
				} else {
					console.error('Failed to rename ' + deviceid + ', server said', err);
				}
			});
	},

	flashDevice: function (deviceid, filePath) {
		var self = this;
		this.checkArguments(arguments);

		var args = Array.prototype.slice.call(arguments);
		if (this.options.target) {
			args = args.filter(function (f) {
				return (f !== '--target' && f !== self.options.target);
			});
			deviceid = args[0];
			filePath = args[1];
		}

		if (!deviceid) {
			console.error('Please specify a device id');
			return when.reject();
		}

		if (!filePath) {
			console.error('Please specify a binary file, source file, or source directory, or known app');
			return when.reject();
		}

		var api = new ApiClient();
		if (!api.ready()) {
			return when.reject('Not logged in');
		}

		if (!fs.existsSync(filePath)) {
			return this._flashKnownApp(api, deviceid, filePath).catch(function(err) {
				console.log('Flash device failed');
				console.log(err);
				return when.reject();
			});
		}

		var version = this.options.target === 'latest' ? null : this.options.target;
		if (version) {
			console.log('Targeting version:', version);
			console.log();
		}

		//make a copy of the arguments sans the 'deviceid'
		args = args.slice(1);
		var files = this._handleMultiFileArgs(args);
		if (!files || files.list.length == 0) {
			console.error('no files included?');
			return when.reject();
		}
		if (settings.showIncludedSourceFiles) {
			console.log('Including:');
			for (var i = 0, n = files.list.length; i < n; i++) {
				console.log('    ' + files.list[i]);
			}
		}

		return this._doFlash(api, deviceid, files, version).catch(function(err) {
			console.log('Flash device failed');
			console.log(err);
			return when.reject();
		});
	},

	_promptForOta: function(api, attrs, files, targetVersion) {
		var self = this;
		var filename;
		return pipeline([
			function() {
				var sourceExtensions = ['.h', '.cpp', '.ino', '.c'];
				var isSourcey = _.some(files.list, function(file) {
					return sourceExtensions.indexOf(path.extname(file)) >= 0;
				});
				if (!isSourcey) {
					return files.list[0];
				}

				filename = temp.path({ suffix: '.bin' });
				return self._compileAndDownload(api, files, attrs.platform_id, filename, targetVersion).then(function() {
					return filename;
				});
			},
			function(file) {
				filename = file;
				return whenNode.lift(fs.stat)(file);
			},
			function(stats) {
				var dataUsage = utilities.cellularOtaUsage(stats.size);

				return when.promise(function(resolve, reject) {
					console.log();
					console.log(alert, 'Flashing firmware Over The Air (OTA) uses cellular data, which may cause you to incur usage charges.');
					console.log(alert, 'This flash is estimated to use at least ' + chalk.bold(dataUsage + ' MB') + ', but may use more depending on network conditions.');
					console.log();
					console.log(alert, 'Please type ' + chalk.bold(dataUsage) + ' below to confirm you wish to proceed with the OTA flash.');
					console.log(alert, 'Any other input will cancel.');

					inquirer.prompt([{
						name: 'confirmota',
						type: 'input',
						message: 'Confirm the amount of data usage in MB:'
					}], function(ans) {
						if (ans.confirmota !== dataUsage) {
							return reject('User cancelled');
						}
						resolve({ list: [filename] });
					});
				});
			}
		]);
	},

	_doFlash: function(api, deviceid, files, targetVersion) {
		var self = this;
		var isCellular;
		return pipeline([
			function isCellular() {
				return api.getAttributes(deviceid);
			},
			function promptOTA(attrs) {
				isCellular = attrs.cellular;
				if (!isCellular) {
					return files;
				}

				return self._promptForOta(api, attrs, files, targetVersion);
			},
			function flashyFlash(flashFiles) {
				return api.flashDevice(deviceid, flashFiles, targetVersion);
			}
		]).then(function(resp) {
			if (resp.status || resp.message) {
				console.log('Flash device OK: ', resp.status || resp.message);
				return when.resolve();
			} else if (resp.errors) {
				var errors = resp.errors.map(function(err) {
					if (err.error) {
						return err.error;
					} else {
						return err;
					}
				});
				return when.reject(errors.join('\n'));
			} else if (resp.info) {
				return when.reject(resp.info);
			} else if (resp.error) {
				return when.reject(resp.error);
			}
			return when.reject();
		});
	},

	_flashKnownApp: function(api, deviceid, filePath) {
		var self = this;
		if (!settings.knownApps[filePath]) {
			console.error("I couldn't find that file: " + filePath);
			return when.reject();
		}

		return pipeline([
			function getAttrs() {
				return api.getAttributes(deviceid);
			},
			function getFile(attrs) {
				var spec = _.find(specs, { productId: attrs.product_id });
				if (spec) {
					if (spec.knownApps[filePath]) {
						return { list: [spec.knownApps[filePath]] };
					}

					if (spec.productName) {
						console.log("I don't have a %s binary for %s.", filePath, spec.productName);
						return when.reject();
					}
				}

				return when.promise(function (resolve, reject) {
					inquirer.prompt([{
						name: 'type',
						type: 'list',
						message: 'Which type of device?',
						choices: [
							'Photon',
							'Core',
							'P1',
							'Electron'
						]
					}], function(ans) {
						var spec = _.find(specs, { productName: ans.type });
						var binary = spec && spec.knownApps[filePath];

						if (!binary) {
							console.log("I don't have a %s binary for %s.", filePath, ans.type);
							return reject();
						}

						resolve({ list: [binary] });
					});
				});
			},
			function doTheFlash(file) {
				return self._doFlash(api, deviceid, file);
			}
		]);
	},

	_getDownloadPath: function(args, deviceType) {
		if (this.options.saveBinaryPath) {
			return this.options.saveBinaryPath;
		}
		//grab the last filename
		var filename = (args.length > 1) ? args[args.length - 1] : null;

		//if it's empty, or it doesn't end in .bin, lets assume it's not an output file.
		//NOTE: because of the nature of 'options at the end', and the only option is --saveTo,
		//this should have no side-effects with other usages.  If we did a more sophisticated
		//argument structure, we'd need to change this logic.
		if (!filename || (utilities.getFilenameExt(filename) !== '.bin')) {
			filename = deviceType + '_firmware_' + Date.now() + '.bin';
		}
		return filename;
	},

	// todo - move this into cli-library-manager and make async
	enumVendoredLibs: function(dir) {
		var src = path.join(dir, 'src');
		var lib = path.join(dir, 'lib');

		// todo - validate each library
		var libs = fs.readdirSync(lib);
		var result = libs.map(function(name) {
			return path.resolve(path.join(lib, name));
		});
		return result;
	},

	launchAndWait: function(cmd, args, verbose) {
		var util  = require('util'),
			spawn = require('child_process').spawn,
			CondVar = require('condvar'),
			proc    = spawn(cmd, args);

//		console.log("launching "+cmd+' '+args);

		// how can there not be a race condition between launching the process
		// and hooking up the event handlers?

		proc.stdout.on('data', function (data) {
			if (verbose)
				console.log('stdout: ' + data);
		});

		proc.stderr.on('data', function (data) {
			if (verbose)
				console.log('stderr: ' + data);
		});

		var exit_code_cv = new CondVar;

		proc.on('exit', function (code) {
			exit_code_cv.send(code);
		});

		var exit_code = exit_code_cv.recv();
		if (exit_code) {
			console.error("Womp womp. Compile job failed. See the output above for details.");
		}
		return exit_code;
	},


	localCompile: function(deviceType) {
		var firmware = settings.profile_json.firmwareDir;
		var libdirs = this.enumVendoredLibs('./');

		var args = {
			platform: deviceType,
			cwd: path.join(firmware, 'main'),
			appdir: path.resolve('./src'),
			applibs: libdirs.join(' '),
			target_dir: path.resolve('./target'),
			target_name: deviceType,
			target: path.resolve(deviceType+'.bin')
		};
		var cmdargs_template =  ['-C', '{{cwd}}', 'all', 'TARGET_DIR={{target_dir}}', 'TARGET_NAME={{target_name}}',
			'PLATFORM={{platform}}', 'APPDIR={{appdir}}', 'APPLIBSV2={{applibs}}'];

		var cmdargs = cmdargs_template.map(function(value) {
			var template = require('hogan.js').compile(value);
			return template.render(args);
		});

		return this.launchAndWait("make", cmdargs, this.options.verbose);
	},

	compileCode: function (deviceType) {
		var self = this;
		this.checkArguments(arguments);
		var args = Array.prototype.slice.call(arguments);
		if (this.options.target) {
			args = args.filter(function (f) {
				return (f !== '--target' && f !== self.options.target);
			});
			deviceType = args[0];
		}

		if (!deviceType) {
			console.error('\nPlease specify the target device type. eg. particle compile photon xxx\n');
			return -1;
		}

		//defaults to 0 for core
		var platform_id = 0;

		if (deviceType in PLATFORMS) {
			platform_id = PLATFORMS[deviceType];
		} else {
			console.error('\nTarget device ' + deviceType + ' is not valid');
			console.error('	eg. particle compile core xxx');
			console.error('	eg. particle compile photon xxx\n');
			return -1;
		}

		if (this.options.local) {
			return this.localCompile(deviceType);
		}

		var api = new ApiClient();
		if (!api.ready()) {
			console.log('Unable to cloud compile. Please make sure you\'re logged in!');
			return -1;
		}

		console.log('\nCompiling code for ' + deviceType);

		//  "Please specify a binary file, source file, or source directory");
		var args = args.slice(1);
		var self = this;

		return pipeline([
			function() {
				// remove arguments that match target data
				if (self.options.target) {
					if (self.options.target === 'latest') {
						return when.resolve();
					}

					return api.getBuildTargets().then(function (data) {
						var validTargets = data.targets.filter(function (t) {
							return t.platforms.indexOf(platform_id) >= 0;
						});
						var validTarget = validTargets.filter(function (t) {
							return t.version === self.options.target;
						});
						if (!validTarget.length) {
							return when.reject(['Invalid build target version.', 'Valid targets:'].concat(_.pluck(validTargets, 'version')));
						}
						var version = validTarget[0].version;
						console.log('Targeting version:', version);
						return when.resolve(version);
					});
				}
				return when.resolve();
			},
			function(targetVersion) {
				console.log();

				if (args.length === 0) {
					args.push('.'); //default to current directory
				}

				var filePath = args[0];
				if (!fs.existsSync(filePath)) {
					console.error("I couldn't find that: " + filePath);
					return when.reject();
				}

				//make a copy of the arguments
				var files = self._handleMultiFileArgs(args);
				if (!files) {
					console.log('No source to compile!');
					return when.reject();
				}

				if (settings.showIncludedSourceFiles) {
					console.log('Including:');
					for (var i = 0, n = files.list.length; i < n; i++) {
						console.log('    ' + files.list[i]);
					}
				}

				var filename = self._getDownloadPath(arguments, deviceType);
				return self._compileAndDownload(api, files, platform_id, filename, targetVersion);
			}
		]).catch(function(err) {
			console.error('Compile failed. Exiting.');
			if (_.isArray(err)) {
				console.log(err.join('\n'));
			} else {
				console.error(err);
			}
			return when.reject();
		});
	},

	_compileAndDownload: function(api, files, platform_id, filename, targetVersion) {
		return pipeline([
			//compile
			function () {
				return api.compileCode(files, platform_id, targetVersion);
			},

			//download
			function (resp) {
				if (resp && resp.binary_url) {
					return api.downloadBinary(resp.binary_url, filename).then(function() {
						return resp.sizeInfo;
					});
				} else {
					return when.reject(resp.errors);
				}
			}
		]).then(
			function (sizeInfo) {
				if (sizeInfo) {
					console.log('Memory use: ');
					console.log(sizeInfo);
				}
				console.log('Compile succeeded.');
				console.log('Saved firmware to:', path.resolve(filename));
			});
	},

	login: function (username) {
		var self = this;

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
			function () {
				return prompts.getCredentials(username);
			},

			//login to the server
			function (creds) {

				var api = new ApiClient();
				username = creds.username;
				self.newSpin('Sending login details...').start();
				return api.login(settings.clientId, creds.username, creds.password);
			},

			function (accessToken) {

				self.stopSpin();
				console.log(arrow, 'Successfully completed login!');
				settings.override(null, 'access_token', accessToken);
				if (username) {
					settings.override(null, 'username', username);
				}
				self.tries = 0;
				return when.resolve(accessToken);
			}
		]);

		return allDone.catch(function (err) {

			self.stopSpin();
			console.log(alert, "There was an error logging you in! Let's try again.");
			console.error(alert, err);
			self.tries = (self.tries || 0) + 1;

			return self.login(username);
		});
	},

	logout: function () {
		var api = new ApiClient();
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
				when: function(ans) {
					return ans.wipe;
				}
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
				console.error('There was an error revoking the token', err);
				allDone.reject(err);
			});
		});

		return allDone.promise;
	},


	getAllDeviceAttributes: function (filter) {
		var self = this;

		var api = new ApiClient();
		if (!api.ready()) {
			return when.reject('not logged in!');
		}

		var lookupVariables = function (devices) {
			if (!devices || (devices.length === 0) || (typeof devices === 'string')) {
				console.log('No devices found.');
			} else {
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
					} else {
						promises.push(when.resolve(device));
					}
				});

				return when.all(promises).then(function (fullDevices) {
					//sort alphabetically
					fullDevices = fullDevices.sort(function (a, b) {
						if (a.connected && !b.connected) {
							return 1;
						}

						return (a.name || '').localeCompare(b.name);
					});
					self.stopSpin();

					if (filter && fullDevices) {
						var filterFunc;
						var platforms = utilities.knownPlatforms();
						if (filter === 'online') {
							filterFunc = function(d) {
								return d.connected;
							};
						} else if (filter === 'offline') {
							filterFunc = function(d) {
								return !d.connected;
							};
						} else if (Object.keys(platforms).indexOf(filter) >= 0) {
							filterFunc = function(d) {
								return d.product_id === platforms[filter];
							};
						} else {
							filterFunc = function(d) {
								return d.id === filter || d.name === filter;
							};
						}

						fullDevices = fullDevices.filter(filterFunc);
					}
					return fullDevices;
				});
			}
		};

		return pipeline([
			api.listDevices.bind(api),
			lookupVariables
		]);
	},


	nyanMode: function(deviceid, onOff) {
		var api = new ApiClient();
		if (!api.ready()) {
			return when.reject('not logged in!');
		}

		if (!onOff || (onOff === '') || (onOff === 'on')) {
			onOff = true;
		} else if (onOff === 'off') {
			onOff = false;
		}

		if ((deviceid === '') || (deviceid === 'all')) {
			deviceid = null;
		} else if (deviceid === 'on') {
			deviceid = null;
			onOff = true;
		} else if (deviceid === 'off') {
			deviceid = null;
			onOff = false;
		}


		if (deviceid) {
			return api.signalDevice(deviceid, onOff).catch(function (err) {
				console.error('Error', err);
				return when.reject(err);
			});
		} else {

			var toggleAll = function (devices) {
				if (!devices || (devices.length === 0)) {
					console.log('No devices found.');
					return when.resolve();
				} else {
					var promises = [];
					devices.forEach(function (device) {
						if (!device.connected) {
							promises.push(when.resolve(device));
							return;
						}
						promises.push(api.signalDevice(device.id, onOff));
					});
					return when.all(promises);
				}
			};


			return pipeline([
				api.listDevices.bind(api),
				toggleAll
			]).catch(function(err) {
				console.error('Error', err);
				return when.reject(err);
			});
		}
	},



	listDevices: function (filter) {

		var formatVariables = function (vars, lines) {
			if (vars) {
				var arr = [];
				for (var key in vars) {
					var type = vars[key];
					arr.push('    ' + key + ' (' + type + ')');
				}

				if (arr.length > 0) {
					//TODO: better way to accomplish this?
					lines.push('  Variables:');
					for (var i=0;i<arr.length;i++) {
						lines.push(arr[i]);
					}
				}

			}
		};
		var formatFunctions = function (funcs, lines) {
			if (funcs && (funcs.length > 0)) {
				lines.push('  Functions:');

				for (var idx = 0; idx < funcs.length; idx++) {
					var name = funcs[idx];
					lines.push('    int ' + name + '(String args) ');
				}
			}
		};

		return this.getAllDeviceAttributes(filter).then(function (devices) {
			if (!devices) {
				return;
			}

			var lines = [];
			for (var i = 0; i < devices.length; i++) {
				var name;
				var device = devices[i];
				var deviceType = '';
				switch (device.product_id) {
					case 0:
						deviceType = ' (Core)';
						break;
					case 6:
						deviceType = ' (Photon)';
						break;
					case 8:
						deviceType = ' (P1)';
						break;
					case 10:
						deviceType = ' (Electron)';
						break;
				}

				if (!device.name || device.name === 'null') {
					name = '<no name>';
				} else {
					name = device.name;
				}

				if (device.connected) {
					name = chalk.cyan.bold(name);
				} else {
					name = chalk.cyan.dim(name);
				}

				var status = name + ' [' + device.id + ']' + deviceType + ' is ';
				status += (device.connected) ? 'online' : 'offline';
				lines.push(status);

				formatVariables(device.variables, lines);
				formatFunctions(device.functions, lines);
			}

			console.log(lines.join('\n'));
		}).catch(function(err) {
			console.log('Error', err);
			return when.reject(err);
		});
	},

	/**
	 * helper function for getting the contents of a directory,
	 * checks for '.include', and a '.ignore' files, and uses their contents
	 * instead
	 * @param {String} dirname
	 * @private
	 * @returns {Array} array of filenames to include
	 */
	_processDirIncludes: function (dirname) {
		dirname = path.resolve(dirname);

		var includesFile = path.join(dirname, settings.dirIncludeFilename),
			ignoreFile = path.join(dirname, settings.dirExcludeFilename);

		var includes = [
			'*.h',
			'*.ino',
			'*.cpp',
			'*.c',
			'project.properties'
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
		var subdirFiles = this._processSubdirIncludes(dirname);
		return files.concat(subdirFiles);
	},

	_processSubdirIncludes: function (dirname) {
		var subdirs = fs.readdirSync(dirname)
		.map(function (file) {
			return path.join(dirname, file);
		})
		.filter(function (filePath) {
		return fs.statSync(filePath).isDirectory();
		});

		return subdirs.reduce(function (subdirFiles, subdir) {
			return subdirFiles.concat(this._processDirIncludes(subdir));
		}.bind(this), []);
	},

	_handleMultiFileArgs: function (arr) {
		//use cases:
		// compile someDir
		// compile someFile
		// compile File1 File2 File3 output.bin
		// compile File1 File2 File3 --saveTo anotherPlace.bin

		if (!arr || arr.length === 0) {
			return null;
		}

		var filenames = arr;
		var files = {
			list: [],
			basePath: ''
		};

		for (var i = 0; i < filenames.length; i++) {
			var filename = filenames[i];
			var ext = utilities.getFilenameExt(filename).toLowerCase();
			var alwaysIncludeThisFile = ((ext === '.bin') && (i === 0) && (filenames.length === 1));

			if (filename.indexOf('--') === 0) {
				// go over the argument
				i++;
				continue;
			}

			try {
				var filestats = fs.statSync(filename);
			} catch (ex) {
				console.error("I couldn't find the file " + filename);
				return null;
			}

			if (filestats.isDirectory()) {
				var dirfiles = this._processDirIncludes(filename);
				filenames = filenames.concat(dirfiles);
				files.basePath = this._updateBasePath(files.basePath, filename);
				continue;
			}

			if (!alwaysIncludeThisFile
				&& utilities.contains(settings.notSourceExtensions, ext)) {
				continue;
			}

			if (filestats.size > settings.MAX_FILE_SIZE) {
				console.log('Skipping ' + filename + " it's too big! " + stats.size);
				continue;
			}
			files.list.push(filename);
			files.basePath = this._updateBasePath(files.basePath, path.dirname(filename));
		}

		return files;
	},

	_updateBasePath: function(basePath, path) {
		if(basePath) {
			return basePath.length < path.length ? basePath : path;
		} else {
			return path;
		}
	}
});

module.exports = CloudCommand;
