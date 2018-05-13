const _ = require('lodash');
const VError = require('verror');
const whenNode = require('when/node');
const prompt = require('inquirer').prompt;
const temp = require('temp').track();

const settings = require('../../settings.js');
const specs = require('../lib/deviceSpecs');
const prompts = require('../lib/prompts.js');
const ApiClient = require('../lib/ApiClient.js');
const utilities = require('../lib/utilities.js');
const spinnerMixin = require('../lib/spinnerMixin');
const ensureError = require('../lib/utilities').ensureError;

const fs = require('fs');
const path = require('path');
const extend = require('xtend');
const util = require('util');
const chalk = require('chalk');

const arrow = chalk.green('>');
const alert = chalk.yellow('!');

class EarlyReturnError extends VError {
	constructor(...args) {
		super(...args);
		Error.captureStackTrace(this, this.constructor);
		this.name = this.constructor.name;
	}
}

// Use known platforms and add shortcuts
const PLATFORMS = extend(utilities.knownPlatforms(), {
	'c': 0,
	'p': 6,
	'e': 10,
	'pi': 31,
	'raspberry-pi': 31,
	'o': 82,
	'd': 88,
	'b': 103,
	'bg': 269,
	'bb': 270
});

class CloudCommand {
	constructor(options) {
		spinnerMixin(this);
		this.options = options;
	}

	claimDevice(deviceId) {
		const api = new ApiClient();
		api.ensureToken();

		console.log('Claiming device ' + deviceId);
		return api.claimDevice(deviceId).then(() => {
			console.log('Successfully claimed device ' + deviceId);
		}, (err) => {
			if (err && typeof error === 'string' && err.indexOf('That belongs to someone else.') >= 0) {
				return prompt([{
					type: 'confirm',
					name: 'transfer',
					message: 'That device belongs to someone else. Would you like to request a transfer?',
					default: true
				}]).then((ans) => {
					if (ans.transfer) {
						return api.claimDevice(deviceId, true).then((body) => {
							console.log('Transfer #' + body.transfer_id + ' requested. You will receive an email if your transfer is approved or denied.');
						});
					}
					throw new Error('You cannot claim a device owned by someone else');
				});
			}

			throw ensureError(err);
		}).catch((err) => {
			throw new VError(ensureError(err), 'Failed to claim device');
		});
	}

	removeDevice(deviceId, { yes }) {
		const api = new ApiClient();
		api.ensureToken();

		return Promise.resolve().then(() => {
			if (yes) {
				return;
			}
			return prompts.areYouSure();
		}).then(() => {
			return api.removeDevice(deviceId).then(() => {
				console.log('Okay!');
			});
		}).catch((err) => {
			throw new VError(ensureError(err), "Didn't remove the device");
		});
	}

	renameDevice(deviceId, name) {
		const api = new ApiClient();
		api.ensureToken();

		console.log('Renaming device ' + deviceId);

		return api.renameDevice(deviceId, name)
			.then(() => {
				console.log('Successfully renamed device ' + deviceId + ' to: ' + name);
			},
			(err) => {
				if (err.info && err.info.indexOf('I didn\'t recognize that device name or ID') >= 0) {
					throw new VError(`Device ${deviceId} not found`);
				} else {
					throw new VError(ensureError(err), `Failed to rename ${deviceId}`);
				}
			});
	}

	flashDevice(deviceId, files, { target, yes }) {
		return Promise.resolve().then(() => {
			if (files.length === 0) {
				// default to current directory
				files.push('.');
			}

			const api = new ApiClient();
			api.ensureToken();

			if (!fs.existsSync(files[0])) {
				return this._flashKnownApp(api, deviceId, files[0]);
			}

			const version = target === 'latest' ? null : target;
			if (version) {
				console.log('Targeting version: ', version);
				console.log();
			}

			return Promise.resolve().then(() => {
				const fileMapping = this._handleMultiFileArgs(files);
				api._populateFileMapping(fileMapping);
				return fileMapping;
			}).then((fileMapping) => {
				if (Object.keys(fileMapping.map).length === 0) {
					throw new VError('no files included');
				}

				if (settings.showIncludedSourceFiles) {
					const list = _.values(fileMapping.map);
					console.log('Including:');
					for (let i = 0, n = list.length; i < n; i++) {
						console.log('    ' + list[i]);
					}
				}

				return this._doFlash(api, deviceId, fileMapping, version);
			});
		}).catch((err) => {
			if (VError.hasCauseWithName(err, EarlyReturnError.name)) {
				console.log(err.message);
				return;
			}

			throw new VError(ensureError(err), 'Flash device failed');
		});
	}

	_promptForOta(api, attrs, fileMapping, targetVersion) {
		const newFileMapping = {
			basePath: fileMapping.basePath,
			map: {}
		};
		return Promise.resolve().then(() => {
			const sourceExtensions = ['.h', '.cpp', '.ino', '.c'];
			const list = Object.keys(fileMapping.map);
			const isSourcey = _.some(list, (file) => {
				return sourceExtensions.indexOf(path.extname(file)) >= 0;
			});
			if (!isSourcey) {
				const binFile = fileMapping.map[list[0]];
				newFileMapping.map[list[0]] = binFile;
				return binFile;
			}

			const filename = temp.path({ suffix: '.bin' });
			return this._compileAndDownload(api, fileMapping, attrs.platform_id, filename, targetVersion).then(() => {
				newFileMapping.map['firmware.bin'] = filename;
				return filename;
			});
		}).then((file) => {
			return whenNode.lift(fs.stat)(file);
		}).then((stats) => {
			const dataUsage = utilities.cellularOtaUsage(stats.size);

			console.log();
			console.log(alert, 'Flashing firmware Over The Air (OTA) uses cellular data, which may cause you to incur usage charges.');
			console.log(alert, 'This flash is estimated to use at least ' + chalk.bold(dataUsage + ' MB') + ', but may use more depending on network conditions.');
			console.log();
			console.log(alert, 'Please type ' + chalk.bold(dataUsage) + ' below to confirm you wish to proceed with the OTA flash.');
			console.log(alert, 'Any other input will cancel.');

			return prompt([{
				name: 'confirmota',
				type: 'input',
				message: 'Confirm the amount of data usage in MB:'
			}]).then((ans) => {
				if (ans.confirmota !== dataUsage) {
					throw new EarlyReturnError('User cancelled');
				}
				return newFileMapping;
			});
		});
	}

	_doFlash(api, deviceId, fileMapping, targetVersion) {
		let isCellular;
		return api.getAttributes(deviceId).then((attrs) => {
			isCellular = attrs.cellular;
			if (!isCellular) {
				return fileMapping;
			} else if (this.options.noconfirm) {
				console.log('! Skipping Bandwidth Prompt !');
				return fileMapping;
			}
			return this._promptForOta(api, attrs, fileMapping, targetVersion);
		}).then((flashFiles) => {
			return api.flashDevice(deviceId, flashFiles, targetVersion);
		}).then((resp) => {
			if (resp.status || resp.message) {
				console.log('Flash device OK: ', resp.status || resp.message);
			} else {
				throw api.normalizedApiError(resp);
			}
		});
	}

	_flashKnownApp(api, deviceid, filePath) {
		if (!settings.knownApps[filePath]) {
			throw new VError(`I couldn't find that file: ${filePath}`);
		}

		return api.getAttributes(deviceid).then((attrs) => {
			const spec = _.find(specs, { productId: attrs.product_id });
			if (spec) {
				if (spec.knownApps[filePath]) {
					return api._populateFileMapping( { list: [spec.knownApps[filePath]] } );
				}

				if (spec.productName) {
					throw new VError(`I don't have a ${filePath} binary for ${spec.productName}.`);
				}
			}

			return prompt([{
				name: 'type',
				type: 'list',
				message: 'Which type of device?',
				choices: [
					'Photon',
					'Core',
					'P1',
					'Electron'
				]
			}]).then((ans) => {
				const spec = _.find(specs, { productName: ans.type });
				const binary = spec && spec.knownApps[filePath];

				if (!binary) {
					throw new VError(`I don't have a ${filePath} binary for ${ans.type}.`);
				}

				return { map: { binary: binary } };
			});
		}).then((file) => {
			return this._doFlash(api, deviceid, file);
		});
	}

	_getDownloadPath(deviceType) {
		if (this.options.saveTo) {
			return this.options.saveTo;
		}

		return deviceType + '_firmware_' + Date.now() + '.bin';
	}

	compileCode() {
		const deviceType = this.options.params.deviceType;
		const files = this.options.params.files;
		let api;
		let platformId;
		let targetVersion;

		return Promise.resolve().then(() => {
			if (files.length === 0) {
				files.push('.'); // default to current directory
			}

			if (deviceType in PLATFORMS) {
				platformId = PLATFORMS[deviceType];
			} else {
				console.error('\nTarget device ' + deviceType + ' is not valid');
				console.error('	eg. particle compile core xxx');
				console.error('	eg. particle compile photon xxx\n');
				return -1;
			}

			api = new ApiClient();
			api.ensureToken();

			console.log('\nCompiling code for ' + deviceType);

			if (this.options.target) {
				if (this.options.target === 'latest') {
					return;
				}

				return api.getBuildTargets().then((data) => {
					const validTargets = data.targets.filter((t) => {
						return t.platforms.indexOf(platformId) >= 0;
					});
					const validTarget = validTargets.filter((t) => {
						return t.version === this.options.target;
					});
					if (!validTarget.length) {
						throw new VError(['Invalid build target version.', 'Valid targets:'].concat(_.pluck(validTargets, 'version')).join('\n'));
					}

					targetVersion = validTarget[0].version;
					console.log('Targeting version:', targetVersion);
				});
			}
		}).then(() => {
			console.log();

			const filePath = files[0];
			if (!fs.existsSync(filePath)) {
				throw new VError(`I couldn't find that: ${filePath}`);
			}

			return this._handleMultiFileArgs(files);
		}).then((fileMapping) => {
			if (!fileMapping) {
				return;
			}

			const list = _.values(fileMapping.map);
			if (list.length === 0) {
				throw new VError('No source to compile!');
			}

			if (settings.showIncludedSourceFiles) {
				console.log('Including:');
				for (let i = 0, n = list.length; i < n; i++) {
					console.log('    ' + list[i]);
				}
			}

			const filename = this._getDownloadPath(deviceType);
			return this._compileAndDownload(api, fileMapping, platformId, filename, targetVersion);
		}).catch((err) => {
			throw new VError(api.normalizedApiError(err), 'Compile failed');
		});
	}

	_compileAndDownload(api, fileMapping, platformId, filename, targetVersion) {
		return Promise.resolve().then(() => {
			// compile
			return api.compileCode(fileMapping, platformId, targetVersion);
		}).then(resp => {
			//download
			if (resp && resp.binary_url) {
				return api.downloadBinary(resp.binary_url, filename).then(() => {
					return resp.sizeInfo;
				});
			} else {
				throw api.normalizedApiError(resp);
			}
		}).then((sizeInfo) => {
			if (sizeInfo) {
				console.log('Memory use: ');
				console.log(sizeInfo);
			}
			console.log('Compile succeeded.');
			console.log('Saved firmware to:', path.resolve(filename));
		});
	}

	login(username, password) {
		if (this.tries >= (password ? 1 : 3)) {
			throw new VError("It seems we're having trouble with logging in.");
		}

		return Promise.resolve().then(() => {
			//prompt for creds
			if (password) {
				return { username: username, password: password };
			}
			return prompts.getCredentials(username, password);
		}).then(creds => {
			//login to the server
			const api = new ApiClient();
			username = creds.username;
			this.newSpin('Sending login details...').start();
			return api.login(settings.clientId, creds.username, creds.password);
		}).then(accessToken => {

			this.stopSpin();
			console.log(arrow, 'Successfully completed login!');
			settings.override(null, 'access_token', accessToken);
			if (username) {
				settings.override(null, 'username', username);
			}
			this.tries = 0;
			return accessToken;
		}).catch((err) => {
			this.stopSpin();
			console.log(alert, "There was an error logging you in! Let's try again.");
			console.error(alert, err);
			this.tries = (this.tries || 0) + 1;

			return this.login(username);
		});
	}


	doLogout(keep, password) {
		const api = new ApiClient();

		return Promise.resolve().then(() => {
			if (!keep) {
				return api.removeAccessToken(settings.username, password, settings.access_token);
			} else {
				console.log(arrow, 'Leaving your token intact.');
			}
		}).then(() => {
			console.log(
				arrow,
				util.format('You have been logged out from %s.',
					chalk.bold.cyan(settings.username))
			);
			settings.override(null, 'username', null);
			settings.override(null, 'access_token', null);
		}).catch(err => {
			throw new VError(ensureError(err), 'There was an error revoking the token');
		});
	}

	logout(noPrompt) {
		if (!settings.access_token) {
			console.log('You were already logged out.');
			return;
		}
		if (noPrompt) {
			return this.doLogout(true);
		}

		return prompt([
			{
				type: 'confirm',
				name: 'keep',
				message: 'Would you like to keep the current authentication token?',
				default: true
			},
			{
				type: 'password',
				name: 'password',
				message: 'Please enter your password',
				when: (ans) => {
					return !ans.keep;
				}
			}
		]).then((ans) => {
			return this.doLogout(ans.keep, ans.password);
		});
	}


	getAllDeviceAttributes(filter) {
		const api = new ApiClient();
		api.ensureToken();

		let filterFunc = null;

		if (filter){
			const platforms = utilities.knownPlatforms();
			if (filter === 'online') {
				filterFunc = (d) => {
					return d.connected;
				};
			} else if (filter === 'offline') {
				filterFunc = (d) => {
					return !d.connected;
				};
			} else if (Object.keys(platforms).indexOf(filter) >= 0) {
				filterFunc = (d) => {
					return d.product_id === platforms[filter];
				};
			} else {
				filterFunc = (d) => {
					return d.id === filter || d.name === filter;
				};
			}
		}

		return Promise.resolve().then(() => {
			return api.listDevices();
		}).then(devices => {
			if (!devices || (devices.length === 0) || (typeof devices === 'string')) {
				console.log('No devices found.');
			} else {
				this.newSpin('Retrieving device functions and variables...').start();
				const promises = [];
				devices.forEach((device) => {
					if (!device.id || (filter && !filterFunc(device))) {
						// Don't request attributes from unnecessary devices...
						return;
					}

					if (device.connected) {
						promises.push(api.getAttributes(device.id).then((attrs) => {
							return extend(device, attrs);
						}));
					} else {
						promises.push(Promise.resolve(device));
					}
				});

				return Promise.all(promises).then(fullDevices => {
					//sort alphabetically
					fullDevices = fullDevices.sort((a, b) => {
						if (a.connected && !b.connected) {
							return 1;
						}

						return (a.name || '').localeCompare(b.name);
					});
					this.stopSpin();
					return fullDevices;
				});
			}
		}).catch(err => {
			throw api.normalizedApiError(err);
		});
	}

	nyanMode() {
		let deviceId = this.options.params.device;
		let onOff = this.options.params.onOff;

		const api = new ApiClient();
		api.ensureToken();

		if (!onOff || (onOff === '') || (onOff === 'on')) {
			onOff = true;
		} else if (onOff === 'off') {
			onOff = false;
		}

		if ((deviceId === '') || (deviceId === 'all')) {
			deviceId = null;
		} else if (deviceId === 'on') {
			deviceId = null;
			onOff = true;
		} else if (deviceId === 'off') {
			deviceId = null;
			onOff = false;
		}

		if (deviceId) {
			return api.signalDevice(deviceId, onOff).catch((err) => {
				throw api.normalizedApiError(err);
			});
		} else {
			return Promise.resolve(() => {
				return api.listDevices();
			}).then(devices => {
				if (!devices || (devices.length === 0)) {
					console.log('No devices found.');
					return;
				} else {
					const promises = [];
					devices.forEach((device) => {
						if (!device.connected) {
							promises.push(Promise.resolve(device));
							return;
						}
						promises.push(api.signalDevice(device.id, onOff));
					});
					return Promise.all(promises);
				}
			}).catch(err => {
				throw api.normalizedApiError(err);
			});
		}
	}

	listDevices() {
		const filter = this.options.params.filter;

		const formatVariables = (vars, lines) => {
			if (vars) {
				const arr = [];
				for (const key in vars) {
					const type = vars[key];
					arr.push('    ' + key + ' (' + type + ')');
				}

				if (arr.length > 0) {
					lines.push('  variables:');
					for (let i=0;i<arr.length;i++) {
						lines.push(arr[i]);
					}
				}
			}
		};
		const formatFunctions = (funcs, lines) => {
			if (funcs && (funcs.length > 0)) {
				lines.push('  Functions:');

				for (let idx = 0; idx < funcs.length; idx++) {
					const name = funcs[idx];
					lines.push('    int ' + name + '(String args) ');
				}
			}
		};

		return this.getAllDeviceAttributes(filter).then((devices) => {
			if (!devices) {
				return;
			}

			const lines = [];
			for (let i = 0; i < devices.length; i++) {
				let name;
				const device = devices[i];
				let deviceType = '';
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
					case 31:
						deviceType = ' (Raspberry Pi)';
						break;
					default:
						deviceType = ' (Product ' + device.product_id + ')';
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

				let status = name + ' [' + device.id + ']' + deviceType + ' is ';
				status += (device.connected) ? 'online' : 'offline';
				lines.push(status);

				formatVariables(device.variables, lines);
				formatFunctions(device.functions, lines);
			}

			console.log(lines.join('\n'));
		});
	}

	/**
	 * Recursively adds files to compile to an object mapping between relative path on the compile server and
	 * path on the local filesystem
	 * @param {Array<string>} filenames  Array of filenames or directory names to include
	 * @returns {Object} Object mapping from filenames seen by the compile server to local relative filenames
	 *
	 * use cases:
	 * compile someDir
	 * compile someFile
	 * compile File1 File2 File3 output.bin
	 * compile File1 File2 File3 --saveTo anotherPlace.bin
	 */
	_handleMultiFileArgs(filenames) {
		const fileMapping = {
			basePath: process.cwd(),
			map: {}
		};

		for (let i = 0; i < filenames.length; i++) {
			const filename = filenames[i];
			const ext = utilities.getFilenameExt(filename).toLowerCase();
			const alwaysIncludeThisFile = ((ext === '.bin') && (i === 0) && (filenames.length === 1));

			if (filename.indexOf('--') === 0) {
				// go over the argument
				i++;
				continue;
			}

			let filestats;
			try {
				filestats = fs.statSync(filename);
			} catch (ex) {
				console.error("I couldn't find the file " + filename);
				return null;
			}

			if (filestats.isDirectory()) {
				this._processDirIncludes(fileMapping, filename);
				continue;
			}

			if (!alwaysIncludeThisFile
				&& utilities.contains(settings.notSourceExtensions, ext)) {
				continue;
			}

			if (!alwaysIncludeThisFile && filestats.size > settings.MAX_FILE_SIZE) {
				console.log('Skipping ' + filename + " it's too big! " + filestats.size);
				continue;
			}

			const relative = path.basename(filename);
			fileMapping.map[relative] = filename;
		}

		return this._handleLibraryExample(fileMapping).then(() => {
			return fileMapping;
		});
	}

	/**
	 * helper function for getting the contents of a directory,
	 * checks for '.include', and a '.ignore' files, and uses their contents
	 * instead
	 * @param {Object} fileMapping Object mapping from filenames seen by the compile server to local filenames,
	 *                             relative to a base path
	 * @param {String} dirname
	 * @private
	 * @returns {nothing} nothing
	 */
	_processDirIncludes(fileMapping, dirname) {
		dirname = path.resolve(dirname);

		const includesFile = path.join(dirname, settings.dirIncludeFilename),
			ignoreFile = path.join(dirname, settings.dirExcludeFilename);
		let hasIncludeFile = false;

		// Recursively find source files
		let includes = [
			'**/*.h',
			'**/*.ino',
			'**/*.cpp',
			'**/*.c',
			'project.properties'
		];

		if (fs.existsSync(includesFile)) {
			//grab and process all the files in the include file.

			includes = utilities.trimBlankLinesAndComments(
				utilities.readAndTrimLines(includesFile)
			);
			hasIncludeFile = true;

		}

		let files = utilities.globList(dirname, includes);

		if (fs.existsSync(ignoreFile)) {
			const ignores = utilities.trimBlankLinesAndComments(
				utilities.readAndTrimLines(ignoreFile)
			);

			const ignoredFiles = utilities.globList(dirname, ignores);
			files = utilities.compliment(files, ignoredFiles);
		}

		// Add files to fileMapping
		files.forEach((file) => {
			// source relative to the base directory of the fileMapping (current directory)
			const source = path.relative(fileMapping.basePath, file);

			// If using an include file, only base names are supported since people are using those to
			// link across relative folders
			let target;
			if (hasIncludeFile) {
				target = path.basename(file);
			} else {
				target = path.relative(dirname, file);
			}
			fileMapping.map[target] = source;
		});
	}


	/**
	 * Perform special case logic when asking to compile a single example from a local library
	 * @param {Object} fileMapping Object mapping from filenames seen by the compile server to local filenames,
	 *                             relative to a base path
	 */
	_handleLibraryExample(fileMapping) {
		return Promise.resolve(() => {
			const list = _.values(fileMapping.map);
			if (list.length === 1) {
				return require('particle-library-manager').isLibraryExample(list[0]);
			}
		}).then(example => {
			if (example) {
				return example.buildFiles(fileMapping);
			}
		});
	}
}

module.exports = CloudCommand;
