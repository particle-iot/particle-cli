const _ = require('lodash');
const VError = require('verror');
const prompt = require('inquirer').prompt;

const settings = require('../../settings');
const specs = require('../lib/deviceSpecs');
const ApiClient = require('../lib/api-client');
const utilities = require('../lib/utilities');
const spinnerMixin = require('../lib/spinner-mixin');
const ensureError = require('../lib/utilities').ensureError;
const prompts = require('../lib/prompts');
const platformsById = require('./constants').platformsById;

const fs = require('fs');
const path = require('path');
const extend = require('xtend');
const util = require('util');
const chalk = require('chalk');

const arrow = chalk.green('>');
const alert = chalk.yellow('!');

// Use known platforms and add shortcuts
const PLATFORMS = extend(utilities.knownPlatforms(), {
	'c': 0,
	'p': 6,
	'e': 10,
	'pi': 31,
	'raspberry-pi': 31,
	'a': 12,
	'b': 13,
	'x': 14,
	'a-series': 22,
	'b-series': 23,
	'x-series': 24,
	'o': 82,
	'd': 88,
	'bl': 103,
	'bg': 269,
	'bb': 270
});

class CloudCommand {
	constructor() {
		spinnerMixin(this);
	}

	claimDevice(deviceId) {
		const api = new ApiClient();
		api.ensureToken();

		console.log('Claiming device ' + deviceId);
		return api.claimDevice(deviceId).then(() => {
			console.log('Successfully claimed device ' + deviceId);
		}, (err) => {
			if (err && typeof err === 'string' && err.indexOf('That belongs to someone else.') >= 0) {
				return prompt([{
					type: 'confirm',
					name: 'transfer',
					message: 'That device belongs to someone else. Would you like to request a transfer?',
					default: true
				}]).then((ans) => {
					if (ans.transfer) {
						return api.claimDevice(deviceId, true).then(() => {
							console.log('Transfer requested. You will receive an email if your transfer is approved or denied.');
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
				return true;
			}
			return prompt([{
				type: 'confirm',
				name: 'remove',
				message: 'Are you sure you want to release ownership of this device?',
				default: true
			}]).then(ans => ans.remove);
		}).then(doit => {
			if (!doit) {
				throw new Error('Not confirmed');
			}
			return api.removeDevice(deviceId);
		}).then(() => {
			console.log('Okay!');
		}).catch((err) => {
			throw new VError(ensureError(err), "Didn't remove the device");
		});
	}

	renameDevice(deviceId, name) {
		const api = new ApiClient();
		api.ensureToken();

		console.log('Renaming device ' + deviceId);

		return Promise.resolve().then(() => {
			return api.renameDevice(deviceId, name);
		}).catch(err => {
			if (err.info && err.info.indexOf('I didn\'t recognize that device name or ID') >= 0) {
				throw new Error('Device not found');
			}
			throw err;
		}).then(() => {
			console.log('Successfully renamed device ' + deviceId + ' to: ' + name);
		}).catch(err => {
			throw new VError(ensureError(err), `Failed to rename ${deviceId}`);
		});
	}

	flashDevice(deviceId, files, { target, followSymlinks }) {
		return Promise.resolve().then(() => {
			if (files.length === 0) {
				// default to current directory
				files.push('.');
			}

			const api = new ApiClient();
			api.ensureToken();

			if (!fs.existsSync(files[0])) {
				return this._flashKnownApp({ api, deviceId, filePath: files[0] });
			}

			const targetVersion = target === 'latest' ? null : target;

			if (targetVersion) {
				console.log('Targeting version: ', targetVersion);
				console.log();
			}

			return Promise.resolve().then(() => {
				const fileMapping = this._handleMultiFileArgs(files, { followSymlinks });
				api._populateFileMapping(fileMapping);
				return fileMapping;
			}).then((fileMapping) => {
				if (Object.keys(fileMapping.map).length === 0) {
					throw new Error('no files included');
				}

				if (settings.showIncludedSourceFiles) {
					const list = _.values(fileMapping.map);
					console.log('Including:');
					for (let i = 0, n = list.length; i < n; i++) {
						console.log('    ' + list[i]);
					}
				}

				return this._doFlash({ api, deviceId, fileMapping, targetVersion });
			});
		}).catch((err) => {
			throw new VError(ensureError(err), 'Flash device failed');
		});
	}

	_doFlash({ api, deviceId, fileMapping, targetVersion }) {
		return Promise.resolve().then(() => {
			return api.flashDevice(deviceId, fileMapping, targetVersion);
		}).then((resp) => {
			if (resp.status || resp.message) {
				console.log('Flash device OK: ', resp.status || resp.message);
			} else if (resp.output === 'Compiler timed out or encountered an error') {
				console.log('\n' + (resp.errors && resp.errors[0]));
				throw new Error('Compiler encountered an error');
			} else {
				throw api.normalizedApiError(resp);
			}
		}).catch(err => {
			throw api.normalizedApiError(err);
		});
	}

	_flashKnownApp({ api, deviceId, filePath }) {
		if (!settings.knownApps[filePath]) {
			throw new VError(`I couldn't find that file: ${filePath}`);
		}

		return api.getAttributes(deviceId).then((attrs) => {
			const spec = _.find(specs, { productId: attrs.product_id });
			if (spec) {
				if (spec.knownApps[filePath]) {
					return api._populateFileMapping( { list: [spec.knownApps[filePath]] } );
				}

				if (spec.productName) {
					throw new VError(`I don't have a ${filePath} binary for ${spec.productName}.`);
				}
			}

			// TODO: this shouldn't be necessary. Just look at the attrs.platform_id instead of
			// product_id above
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
		}).then((fileMapping) => {
			return this._doFlash({ api, deviceId, fileMapping });
		});
	}

	_getDownloadPath(deviceType, saveTo) {
		if (saveTo) {
			return saveTo;
		}

		return deviceType + '_firmware_' + Date.now() + '.bin';
	}

	compileCode(deviceType, files, { target, saveTo, followSymlinks }) {
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
				throw new Error([
					'Target device ' + deviceType + ' is not valid',
					'	eg. particle compile core xxx',
					'	eg. particle compile photon xxx'
				].join('\n'));
			}

			api = new ApiClient();
			api.ensureToken();

			console.log('\nCompiling code for ' + deviceType);

			if (target) {
				if (target === 'latest') {
					return;
				}

				return api.getBuildTargets().catch(err => {
					throw api.normalizedApiError(err);
				}).then((data) => {
					const validTargets = data.targets.filter((t) => {
						return t.platforms.indexOf(platformId) >= 0;
					});
					const validTarget = validTargets.filter((t) => {
						return t.version === target;
					});
					if (!validTarget.length) {
						throw new VError(['Invalid build target version.', 'Valid targets:'].concat(_.map(validTargets, 'version')).join('\n'));
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

			return this._handleMultiFileArgs(files, { followSymlinks });
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

			const filename = this._getDownloadPath(deviceType, saveTo);
			return this._compileAndDownload(api, fileMapping, platformId, filename, targetVersion);
		}).catch((err) => {
			throw new VError(ensureError(err), 'Compile failed');
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
			} else if (resp && resp.output === 'Compiler timed out or encountered an error') {
				console.log('\n' + (resp && resp.errors && resp.errors[0]));
				throw new Error('Compiler encountered an error');
			} else {
				throw api.normalizedApiError(resp);
			}
		}).catch(err => {
			throw api.normalizedApiError(err);
		}).then((sizeInfo) => {
			if (sizeInfo) {
				console.log('Memory use: ');
				console.log(sizeInfo);
			}
			console.log('Compile succeeded.');
			console.log('Saved firmware to:', path.resolve(filename));
		});
	}

	login({ username, password, token, otp } = {}) {
		const shouldRetry = !((username && password) || token && !this.tries);

		return Promise.resolve()
			.then(() => {
				if (token){
					return { token, username, password };
				}
				if (username && password){
					return { username, password };
				}
				return prompts.getCredentials(username, password);
			})
			.then(credentials => {
				const { token, username, password } = credentials;
				const api = new ApiClient();

				this.newSpin('Sending login details...').start();
				this._usernameProvided = username;

				if (token) {
					return this.stopSpinAfterPromise(api.getUser(token).then((response) => {
						return {
							token,
							username: response.username
						};
					}));
				}
				return this.stopSpinAfterPromise(api.login(settings.clientId, username, password))
					.catch((error) => {
						if (error.error === 'mfa_required') {
							this.tries = 0;
							return this.enterOtp({ otp, mfaToken: error.mfa_token, shouldRetry });
						}
						throw error;
					}).then(body => ({ token: body.access_token, username }));
			})
			.then(credentials => {
				const { token, username } = credentials;

				console.log(arrow, 'Successfully completed login!');

				settings.override(null, 'access_token', token);

				if (username) {
					settings.override(null, 'username', username);
				}

				this._usernameProvided = null;
				this.tries = 0;

				return token;
			})
			.catch(error => {
				console.log(alert, `There was an error logging you in! ${shouldRetry ? "Let's try again." : ''}`);
				console.error(alert, error.message || error.error_description);
				this.tries = (this.tries || 0) + 1;

				if (shouldRetry && this.tries < 3){
					return this.login({ username: this._usernameProvided });
				}
				throw new VError("It seems we're having trouble with logging in.");
			});
	}

	enterOtp({ otp, mfaToken, shouldRetry = true }) {
		return Promise.resolve().then(() => {
			if (!this.tries) {
				console.log('Use your authenticator app on your mobile device to get a login code.');
				console.log('Lost access to your phone? Visit https://login.particle.io/account-info');
			}

			if (otp) {
				return otp;
			}
			return prompts.getOtp();
		}).then(_otp => {
			otp = _otp;
			this.newSpin('Sending login code...').start();

			const api = new ApiClient();
			return this.stopSpinAfterPromise(api.sendOtp(settings.clientId, mfaToken, otp));
		}).catch(error => {
			console.log(alert, `This login code didn't work. ${shouldRetry ? "Let's try again." : ''}`);
			console.error(alert, error.message || error.error_description);
			this.tries = (this.tries || 0) + 1;

			if (shouldRetry && this.tries < 3){
				return this.enterOtp({ mfaToken, shouldRetry });
			}
			throw new VError('Recover your account at https://login.particle.io/account-info');
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

				return this.stopSpinAfterPromise(Promise.all(promises).then(fullDevices => {
					//sort alphabetically
					fullDevices = fullDevices.sort((a, b) => {
						if (a.connected && !b.connected) {
							return 1;
						}

						return (a.name || '').localeCompare(b.name);
					});
					return fullDevices;
				}));
			}
		}).catch(err => {
			throw api.normalizedApiError(err);
		});
	}

	nyanMode(deviceId, onOff) {
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

	listDevices(filter) {
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
				const deviceType = platformsById[device.product_id] || `Product ${device.product_id}`;
				const connectedState = device.connected ? 'online' : 'offline';

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

				const status = `${name} [${device.id}] (${deviceType}) is ${connectedState}`;
				lines.push(status);

				formatVariables(device.variables, lines);
				formatFunctions(device.functions, lines);
			}

			console.log(lines.join('\n'));
		}).catch((err) => {
			throw new VError(ensureError(err), 'Failed to list device');
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
	_handleMultiFileArgs(filenames, { followSymlinks } = {}){
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
				this._processDirIncludes(fileMapping, filename, { followSymlinks });
				continue;
			}

			if (!alwaysIncludeThisFile && settings.notSourceExtensions.includes(ext)) {
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
	_processDirIncludes(fileMapping, dirname, { followSymlinks } = {}){
		dirname = path.resolve(dirname);

		const includesFile = path.join(dirname, settings.dirIncludeFilename);
		const ignoreFile = path.join(dirname, settings.dirExcludeFilename);
		let hasIncludeFile = false;

		// Recursively find source files
		let includes = [
			'**/*.h',
			'**/*.hpp',
			'**/*.hh',
			'**/*.hxx',
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

		let files = utilities.globList(dirname, includes, { followSymlinks });

		if (fs.existsSync(ignoreFile)) {
			const ignores = utilities.trimBlankLinesAndComments(
				utilities.readAndTrimLines(ignoreFile)
			);

			const ignoredFiles = utilities.globList(dirname, ignores, { followSymlinks });
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
		return Promise.resolve().then(() => {
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
