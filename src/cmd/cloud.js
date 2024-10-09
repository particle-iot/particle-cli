const os = require('os');
const _ = require('lodash');
const VError = require('verror');
const prompt = require('inquirer').prompt;

const settings = require('../../settings');
const deviceSpecs = require('../lib/device-specs');
const ApiClient = require('../lib/api-client'); // TODO (mirande): remove in favor of `ParticleAPI`
const { normalizedApiError } = require('../lib/api-client');
const utilities = require('../lib/utilities');
const ensureError = require('../lib/utilities').ensureError;
const ParticleAPI = require('./api');
const prompts = require('../lib/prompts');
const CLICommandBase = require('./base');

const fs = require('fs-extra');
const path = require('path');
const extend = require('xtend');
const chalk = require('chalk');
const temp = require('temp').track();
const { ssoLogin, waitForLogin, getLoginMessage } = require('../lib/sso');
const BundleCommands  = require('./bundle');
const { sourcePatterns } = require('../lib/file-types');

const arrow = chalk.green('>');
const alert = chalk.yellow('!');

// Use known platforms and add shortcuts
const PLATFORMS = utilities.knownPlatformIdsWithAliases();
const PLATFORMS_ID_TO_NAME = _.invert(utilities.knownPlatformIds());

module.exports = class CloudCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	listDevices({ params: { filter } }){
		return this.getAllDeviceAttributes(filter)
			.then((devices) => {
				if (!devices){
					return;
				}
				this.ui.logDeviceDetail(devices);
			})
			.catch((err) => {
				throw new VError(ensureError(err), 'Failed to list device');
			});
	}

	claimDevice({ params: { deviceID } }){
		const api = createAPI();

		this.ui.stdout.write(`Claiming device ${deviceID}${os.EOL}`);

		return api.claimDevice(deviceID)
			.then(() => this.ui.stdout.write(`Successfully claimed device ${deviceID}${os.EOL}`))
			.catch((err) => {
				const error = formatAPIErrorMessage(err);

				if (error.canRequestTransfer){
					const question = {
						type: 'confirm',
						name: 'transfer',
						message: 'That device belongs to someone else. Would you like to request a transfer?',
						default: true
					};

					return prompt(question)
						.then(({ transfer }) => {
							if (transfer){
								return api.claimDevice(deviceID, true)
									.then(() => this.ui.stdout.write(`Transfer requested. You will receive an email if your transfer is approved or denied.${os.EOL}`));
							}
							throw new Error('You cannot claim a device owned by someone else');
						});
				}

				throw error;
			})
			.catch((error) => {
				const message = 'Failed to claim device';
				throw createAPIErrorResult({ error, message });
			});
	}

	removeDevice({ yes, params: { device } }){
		return Promise.resolve()
			.then(() => {
				if (yes){
					return true;
				}
				const question = {
					type: 'confirm',
					name: 'remove',
					message: 'Are you sure you want to release ownership of this device?',
					default: true
				};
				return prompt(question).then(({ remove }) => remove);
			})
			.then(remove => {
				if (!remove){
					throw new Error('Not confirmed');
				}
				this.ui.stdout.write(`releasing device ${device}${os.EOL}`);
				return createAPI().removeDevice(device);
			})
			.then(() => this.ui.stdout.write(`Okay!${os.EOL}`))
			.catch((error) => {
				const message = 'Didn\'t remove the device';
				throw createAPIErrorResult({ error, message });
			});
	}

	renameDevice({ params: { device, name } }){
		this.ui.stdout.write(`Renaming device ${device}${os.EOL}`);
		return Promise.resolve()
			.then(() => createAPI().renameDevice(device, name))
			.catch(err => {
				if (err.info && err.info.includes('I didn\'t recognize that device name or ID')){
					throw new Error('Device not found');
				}
				throw err;
			})
			.then(() => this.ui.stdout.write(`Successfully renamed device ${device} to: ${name}${os.EOL}`))
			.catch((error) => {
				const message = `Failed to rename ${device}`;
				throw createAPIErrorResult({ error, message });
			});
	}

	async flashDevice({ target, followSymlinks, product, params: { device, files } }){
		if (product){
			if (!this.isDeviceId(device)){
				await this.showProductDeviceNameUsageError(device);
			}
		}

		try {
			if (files.length === 0) {
				// default to current directory
				files.push('.');
			}

			const filename = files[0];

			if (!await fs.exists(filename)) {
				await this._flashKnownApp({ product, deviceId: device, filePath: files[0] });
				return;
			}

			let fileMapping;
			// check if extension is .bin or .zip
			const ext = path.extname(filename);
			if (['.bin', '.zip'].includes(ext)) {
				fileMapping = { map: { [filename]: filename } };
			} else {
				this.ui.stdout.write(`Compiling code for ${device}${os.EOL}`);

				const attrs = await createAPI().getDeviceAttributes(device);
				let platformId = attrs.platform_id;
				const deviceType = PLATFORMS_ID_TO_NAME[platformId];
				const saveTo = temp.path({ suffix: '.zip' }); // compileCodeImpl will pick between .bin and .zip as appropriate

				const { filename } = await this.compileCodeImpl({ target, followSymlinks, saveTo, deviceType, platformId, files });

				fileMapping = { map: { [filename]: filename } };
			}

			await this._doFlash({ product, deviceId: device, fileMapping });

			this.ui.stdout.write(`Flash success!${os.EOL}`);
		} catch (error) {
			const message = `Failed to flash ${device}`;
			throw createAPIErrorResult({ error, message });
		}
	}

	async _doFlash({ product, deviceId, fileMapping, targetVersion }){
		try {
			if (product) {
				this.ui.stdout.write(`Marking device ${deviceId} as a development device${os.EOL}`);
				await createAPI().markAsDevelopmentDevice(deviceId, true, product);
			}

			this.ui.logFirstTimeFlashWarning();
			this.ui.stdout.write(`Flashing firmware to your device ${deviceId}${os.EOL}`);

			const resp = await createAPI().flashDevice(deviceId, fileMapping, targetVersion, product);
			if (!resp.status && !resp.message) {
				throw normalizedApiError(resp);
			}

			if (product) {
				[
					`Device ${deviceId} is now marked as a developement device and will NOT receive automatic product firmware updates.`,
					'To resume normal updates, please visit:',
					// TODO (mirande): replace w/ instructions on how to unmark
					// via the CLI once that command is available
					`https://console.particle.io/${product}/devices/unmark-development/${deviceId}`
				].forEach(line => this.ui.stdout.write(`${line}${os.EOL}`));
			}
		} catch (err) {
			throw normalizedApiError(err);
		}
	}

	async _flashKnownApp({ product, deviceId, filePath }){
		if (!settings.cloudKnownApps[filePath]){
			throw new VError(`I couldn't find that file: ${filePath}`);
		}

		const attrs = await createAPI().getDeviceAttributes(deviceId);
		let platformId = attrs.platform_id;

		if (product || attrs.platform_id !== attrs.product_id){
			if (!product){
				product = attrs.product_id;
			}

			if (!this.isDeviceId(deviceId)){
				deviceId = attrs.id;
			}
		}

		let fileMapping;
		const specs = _.find(deviceSpecs, { productId: platformId }); // b/c legacy naming

		if (specs){
			if (specs.knownApps[filePath]){
				const app = specs.knownApps[filePath];
				fileMapping = { map: { [app]: app } };
			} else {
				throw new VError(`I don't have a ${filePath} binary for ${specs.productName}.`);
			}
		} else {
			throw new Error(`Unable to find ${filePath} for platform ${platformId}`);
		}

		await this._doFlash({ product, deviceId, fileMapping });
	}

	_getDownloadPathForBin(deviceType, saveTo){
		if (saveTo) {
			return (utilities.getFilenameExt(saveTo) === '.zip') ? (utilities.filenameNoExt(saveTo) + '.bin') : saveTo;
		}
		return deviceType + '_firmware_' + Date.now() + '.bin';
	}

	_getBundleSavePath(deviceType, saveTo, assets){
		if (!assets) {
			return;
		}
		if (!saveTo){
			return deviceType + '_firmware_' + Date.now() + '.zip';
		} else if (path.extname(saveTo) !== '.zip'){
			throw new Error('saveTo must have a .zip extension when project includes assets');
		} else {
			return saveTo;
		}
	}

	// create a new function that handles errors from compileCode function
	async compileCode({ target, followSymlinks, saveTo, params: { deviceType, files } }){
		try {
			if (files.length === 0) {
				files.push('.'); // default to current directory
			}

			let platformId;
			if (deviceType in PLATFORMS) {
				platformId = PLATFORMS[deviceType];
			} else {
				throw new Error([
					`Target device ${deviceType} is not valid`,
					'	eg. particle compile boron xxx',
					'	eg. particle compile p2 xxx'
				].join('\n'));
			}

			this.ui.stdout.write(`Compiling code for ${deviceType}${os.EOL}`);

			const { filename, isBundle } = await this.compileCodeImpl({ target, followSymlinks, saveTo, deviceType, platformId, files });

			this.ui.stdout.write(`Saved ${isBundle ? 'bundle' : 'firmware' } to: ${filename}${os.EOL}`);
		} catch (error) {
			const message = 'Compile failed';
			throw createAPIErrorResult({ error, message });
		}
	}

	async compileCodeImpl({ target, followSymlinks, saveTo, deviceType, platformId, files }) {
		let targetVersion, assets;

		ensureAPIToken();

		if (target) {
			if (target === 'latest') {
				return;
			}

			let data;
			try {
				data = await createAPI().listDeviceOsVersions(platformId);
			} catch (error) {
				throw normalizedApiError(error);
			}

			const validTargets = data.versions.filter((t) => t.release_state !== 'archived');
			const validTarget = validTargets.filter((t) => t.version === target);
			if (!validTarget.length) {
				throw new VError(['Invalid build target version.', 'Valid targets:'].concat(validTargets.map((v) => `${v.version} ${v.release_state === 'preview' ? '(preview)' : ''}`)).join('\n'));
			}
			targetVersion = validTarget[0].version;
			this.ui.stdout.write(`Targeting version: ${targetVersion}${os.EOL}`);
		}

		const filePath = files[0];
		this.ui.stdout.write(os.EOL);

		if (!await fs.exists(filePath)) {
			throw new VError(`I couldn't find that: ${filePath}`);
		}

		const assetsPath = await this._checkForAssets(files);
		if (assetsPath) {
			assets = await new BundleCommands()._getAssets({ assetsPath });
		}

		const fileMapping = await this._handleMultiFileArgs(files, { followSymlinks });
		if (!fileMapping) {
			return;
		}
		const list = _.values(fileMapping.map);
		if (list.length === 0) {
			throw new VError('No source to compile!');
		}

		if (settings.showIncludedSourceFiles) {
			this.ui.stdout.write(`Including:${os.EOL}`);

			for (const sourceFile of list) {
				this.ui.stdout.write(`    ${sourceFile}${os.EOL}`);
			}
			if (assets) {
				for (const asset of assets) {
					this.ui.stdout.write(`    ${asset.path}${os.EOL}`);
				}
			}

			this.ui.stdout.write(os.EOL);
		}

		let filename = this._getDownloadPathForBin(deviceType, saveTo);
		const bundleFilename = this._getBundleSavePath(deviceType, saveTo, assets);
		return this._compileAndDownload({ fileMapping, platformId, filename, targetVersion, assets, bundleFilename });
	}

	async _compileAndDownload({ fileMapping, platformId, filename, targetVersion, assets, bundleFilename }){
		let respSizeInfo, bundle, resp;

		try {
			resp = await createAPI().compileCode(fileMapping, platformId, targetVersion);
		} catch (error) {
			throw normalizedApiError(error);
		}

		if (resp && resp.binary_url && resp.binary_id) {
			let data;
			try {
				data = await createAPI().downloadFirmwareBinary(resp.binary_id);
			} catch (error) {
				throw normalizedApiError(error);
			}

			await fs.writeFile(filename, data);
			respSizeInfo = resp.sizeInfo;
		} else if (resp && resp.output === 'Compiler timed out or encountered an error'){
			this.ui.stdout.write(`${os.EOL}${(resp && resp.errors && resp.errors[0])}${os.EOL}`);
			throw new Error('Compiler encountered an error');
		} else {
			throw normalizedApiError(resp);
		}

		let message = 'Compile succeeded.';
		if (assets) {
			bundle = await new BundleCommands()._generateBundle({ assetsList: assets, appBinary: filename, bundleFilename: bundleFilename });
			message = 'Compile succeeded and bundle created.';
		}

		this.ui.stdout.write(`${message}${os.EOL}${os.EOL}`);

		if (respSizeInfo){
			this._showMemoryStats(respSizeInfo);
		}

		if (bundle) {
			if (await fs.exists(filename)){
				await fs.unlink(filename);
			}
			return {
				isBundle: true,
				filename: path.resolve(bundleFilename)
			};
		} else {
			return {
				isBundle: false,
				filename: path.resolve(filename)
			};
		}
	}

	_showMemoryStats(sizeInfo) {
		const stats = this._parseMemoryStats(sizeInfo);
		if (stats) {
			const rightAlign = (str, len) => `${' '.repeat(len - str.length)}${str}`;

			this.ui.stdout.write(`Memory use:${os.EOL}`);
			this.ui.stdout.write(rightAlign('Flash', 9) + rightAlign('RAM', 9) + os.EOL);
			this.ui.stdout.write(rightAlign(stats.flash.toString(), 9) + rightAlign(stats.ram.toString(), 9) + os.EOL);
			this.ui.stdout.write(os.EOL);
		}
	}

	_parseMemoryStats(sizeInfo) {
		if (!sizeInfo) {
			return null;
		}
		const lines = sizeInfo.split('\n');
		if (lines.length < 2) {
			return null;
		}

		const fields = lines[0].replace(/^\s+/, '').split(/\s+/);
		const values = lines[1].replace(/^\s+/, '').split(/\s+/);

		const sizes = {};
		for (let i = 0; i < fields.length && i < 4; i++) {
			sizes[fields[i]] = parseInt(values[i], 10);
		}

		if (!('text' in sizes && 'data' in sizes && 'bss' in sizes)) {
			return null;
		}

		return {
			flash: sizes.text + sizes.data, // text is code, data is the constant data
			ram: sizes.bss + sizes.data // bss is non-initialized or 0 initialized ram, data is ram initialized from values in flash
		};
	}

	login({ username, password, token, otp, sso } = {}){

		const shouldRetry = !((username && password) || (token || sso) && !this.tries);


		return Promise.resolve()
			.then(() => {
				if (sso) {
					return { sso };
				}
				if (token){
					return { token, username, password };
				}
				if (username && password){
					return { username, password };
				}
				return prompts.getCredentials(username, password);
			})
			.then(credentials => {
				const { token, username, password, sso } = credentials;
				const msg = 'Sending login details...';
				const api = new ApiClient(null, token);

				this._usernameProvided = username;

				if (sso) {
					const ssoMessage = 'SSO login in progress...';
					return ssoLogin().then(({ deviceCode, verificationUriComplete }) => {
						getLoginMessage(verificationUriComplete).map(msg => {
							this.ui.stdout.write(`${msg}${os.EOL}`);
						});
						return this.ui.showBusySpinnerUntilResolved(ssoMessage, waitForLogin({ deviceCode }))
							.then(response => ({ token: response.token, username: response.username }));
					});
				}

				if (token){
					return this.ui.showBusySpinnerUntilResolved(msg, api.getUser())
						.then(response => ({ token, username: response.username }));
				}
				const login = api.login(settings.clientId, username, password);
				return this.ui.showBusySpinnerUntilResolved(msg, login)
					.catch((error) => {
						if (error.error === 'mfa_required'){
							this.tries = 0;
							return this.enterOtp({ otp, mfaToken: error.mfa_token, shouldRetry });
						}
						throw error;
					})
					.then(body => ({ token: body.access_token, username }));
			})
			.then(credentials => {
				const { token, username } = credentials;

				this.ui.stdout.write(`${arrow} Successfully completed login!${os.EOL}`);
				settings.override(null, 'access_token', token);

				if (username){
					settings.override(null, 'username', username);
				}

				this._usernameProvided = null;
				this.tries = 0;

				return token;
			})
			.catch(error => {
				this.ui.stdout.write(`${alert} There was an error logging you in! ${shouldRetry ? "Let's try again." : ''}${os.EOL}`);
				this.ui.stderr.write(`${alert} ${error.message || error.error_description}${os.EOL}`);
				this.tries = (this.tries || 0) + 1;

				if (shouldRetry && this.tries < 3){
					return this.login({ username: this._usernameProvided });
				}
				throw new VError("It seems we're having trouble with logging in.");
			});
	}

	enterOtp({ otp, mfaToken, shouldRetry = true }){
		return Promise.resolve()
			.then(() => {
				if (!this.tries){
					this.ui.stdout.write(`Use your authenticator app on your mobile device to get a login code.${os.EOL}`);
					this.ui.stdout.write(`Lost access to your phone? Visit https://login.particle.io/account-info${os.EOL}`);
				}

				if (otp){
					return otp;
				}
				return prompts.getOtp();
			})
			.then(_otp => {
				otp = _otp;
				const api = new ApiClient();
				const msg = 'Sending login code...';
				const sendOtp = api.sendOtp(settings.clientId, mfaToken, otp);
				return this.ui.showBusySpinnerUntilResolved(msg, sendOtp);
			})
			.catch(error => {
				this.ui.stdout.write(`${alert} This login code didn't work. ${shouldRetry ? "Let's try again." : ''}${os.EOL}`);
				this.ui.stderr.write(`${alert} ${error.message || error.error_description}${os.EOL}`);
				this.tries = (this.tries || 0) + 1;

				if (shouldRetry && this.tries < 3){
					return this.enterOtp({ mfaToken, shouldRetry });
				}
				throw new VError('Recover your account at https://login.particle.io/account-info');
			});
	}

	async logout(){
		if (!settings.access_token){
			this.ui.stdout.write(`You were already logged out.${os.EOL}`);
			return;
		}

		try {
			await createAPI().deleteCurrentAccessToken();
			this.ui.stdout.write(`${arrow} You have been logged out from ${chalk.bold.cyan(settings.username)}${os.EOL}`);
			settings.override(null, 'username', null);
			settings.override(null, 'access_token', null);
		} catch (err) {
			throw new VError(ensureError(err), 'There was an error revoking the token');
		}
	}


	getAllDeviceAttributes(filter) {
		const { buildDeviceFilter } = utilities;
		const api = new ApiClient();
		api.ensureToken();

		let filterFunc = buildDeviceFilter(filter);

		return Promise.resolve()
			.then(() => api.listDevices())
			.then(devices => {
				if (!devices || (devices.length === 0) || (typeof devices === 'string')){
					this.ui.stdout.write(`No devices found.${os.EOL}`);
				} else {
					const msg = 'Retrieving device functions and variables...';
					const promises = [];

					devices.forEach((device) => {
						if (!device.id || (filter && !filterFunc(device))){
							// Don't request attributes from unnecessary devices...
							return;
						}

						if (device.connected){
							promises.push(
								api.getAttributes(device.id)
									.then(attrs => extend(device, attrs))
							);
						} else {
							promises.push(Promise.resolve(device));
						}
					});

					return this.ui.showBusySpinnerUntilResolved(msg, Promise.all(promises))
						.then(fullDevices => fullDevices.sort((a, b) => {
							if (a.connected && !b.connected){
								return 1;
							}

							return (a.name || '').localeCompare(b.name);
						}));
				}
			}).catch(err => {
				throw api.normalizedApiError(err);
			});
	}

	nyanMode({ product, params: { device, onOff } }){
		if (product){
			if (!this.isDeviceId(device)){
				return this.showProductDeviceNameUsageError(device);
			}
		}

		const api = createAPI();

		if (!onOff || (onOff === '') || (onOff === 'on')){
			onOff = true;
		} else if (onOff === 'off'){
			onOff = false;
		}

		return Promise.resolve()
			.then(() => {
				if (device){
					return api.signalDevice(device, onOff, product);
				} else {
					return Promise.resolve()
						.then(() => api.listDevices())
						.then(devices => {
							if (!devices || (devices.length === 0)){
								this.ui.stdout.write(`No devices found.${os.EOL}`);
								return;
							} else {
								const promises = [];
								devices.forEach((device) => {
									if (!device.connected){
										promises.push(Promise.resolve(device));
										return;
									}
									promises.push(api.signalDevice(device.id, onOff, product));
								});
								return Promise.all(promises);
							}
						});
				}
			})
			.catch((error) => {
				const message = 'Signaling failed';
				throw createAPIErrorResult({ error, message });
			});
	}

	/**
	 * Checks if the given filepath contains an assets directory
	 * @param filePath
	 * @returns {string} path to assets directory if it exists, otherwise undefined
	 * @private
	 */
	async _checkForAssets(files) {
		for (const file of files) {
			const propPath = path.join(file, 'project.properties');
			try {
				const savedPropObj = await utilities.parsePropertyFile(propPath);

				if (savedPropObj.assetOtaDir && savedPropObj.assetOtaDir !== '') {
					return path.join(file, savedPropObj.assetOtaDir);
				}
			} catch (error) {
				// Ignore parsing or stat errors
			}
		}
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
	 * TODO: Rework this to be async
	 */
	_handleMultiFileArgs(filenames, { followSymlinks } = {}){
		const fileMapping = {
			basePath: process.cwd(),
			map: {}
		};
		for (let i = 0; i < filenames.length; i++){
			const filename = filenames[i];
			const ext = utilities.getFilenameExt(filename);
			const alwaysIncludeThisFile = ((ext === '.bin') && (i === 0) && (filenames.length === 1));

			if (filename.indexOf('--') === 0){
				// go over the argument
				i++;
				continue;
			}

			let filestats;
			try {
				filestats = fs.statSync(filename);
			} catch (ex){
				console.error("I couldn't find the file " + filename);
				return null;
			}

			if (filestats.isDirectory()){
				this._processDirIncludes(fileMapping, filename, { followSymlinks });
				continue;
			}

			if (!alwaysIncludeThisFile && settings.notSourceExtensions.includes(ext)){
				continue;
			}

			if (!alwaysIncludeThisFile && filestats.size > settings.MAX_FILE_SIZE){
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
		let files = new Set();

		this._getDefaultIncludes(files, dirname, { followSymlinks });
		this._getDefaultIgnores(files, dirname, { followSymlinks });
		this._getCustomIncludes(files, dirname, { followSymlinks });
		this._getCustomIgnores(files, dirname, { followSymlinks });

		// Add files to fileMapping
		const sortedFiles = Array.from(files.values()).sort();
		sortedFiles.forEach((file) => {
			// source relative to the base directory of the fileMapping (current directory)
			const source = path.relative(fileMapping.basePath, file);
			const target = path.relative(dirname, file);
			fileMapping.map[target] = source;
		});
	}

	_getDefaultIncludes(files, dirname, { followSymlinks }) {
		// Recursively find source files
		const result = utilities.globList(dirname, sourcePatterns, { followSymlinks });
		result.forEach((file) => files.add(file));
	}

	_getCustomIncludes(files, dirname, { followSymlinks }) {
		const includeFiles = utilities.globList(dirname, ['**/particle.include'], { followSymlinks });

		for (const includeFile of includeFiles) {
			const includeDir = path.dirname(includeFile);
			const globsToInclude = utilities.trimBlankLinesAndComments(utilities.readAndTrimLines(includeFile));
			if (!globsToInclude || !globsToInclude.length) {
				continue;
			}
			const includePaths = utilities.globList(includeDir, globsToInclude, { followSymlinks });
			includePaths.forEach((file) => files.add(file));
		}
	}

	_getDefaultIgnores(files, dirname, { followSymlinks }) {
		// Recursively find default ignore files
		let ignores = [
			'lib/*/examples/**/*.*'
		];

		const result = utilities.globList(dirname, ignores, { followSymlinks });
		result.forEach((file) => files.delete(file));
	}

	_getCustomIgnores(files, dirname, { followSymlinks }) {
		const ignoreFiles = utilities.globList(dirname, ['**/particle.ignore'], { followSymlinks });

		for (const ignoreFile of ignoreFiles) {
			const ignoreDir = path.dirname(ignoreFile);
			const globsToIgnore = utilities.trimBlankLinesAndComments(utilities.readAndTrimLines(ignoreFile));
			if (!globsToIgnore || !globsToIgnore.length) {
				continue;
			}
			const globList = globsToIgnore.map(g => g);
			const ignoredPaths = utilities.globList(ignoreDir, globList, { followSymlinks });
			ignoredPaths.forEach((file) => files.delete(file));
		}
	}


	/**
	 * Perform special case logic when asking to compile a single example from a local library
	 * @param {Object} fileMapping Object mapping from filenames seen by the compile server to local filenames,
	 *                             relative to a base path
	 */
	_handleLibraryExample(fileMapping){
		return Promise.resolve().then(() => {
			const list = _.values(fileMapping.map);
			if (list.length >= 1){
				return require('particle-library-manager').isLibraryExample(list[0]);
			}
		}).then(example => {
			if (example){
				return example.buildFiles(fileMapping);
			}
		});
	}
};


// UTILS //////////////////////////////////////////////////////////////////////
function createAPI(){
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}

function createAPIErrorResult({ error: e, message, json }){
	const error = new VError(formatAPIErrorMessage(e), message);
	error.asJSON = json;
	return error;
}

// TODO (mirande): reconcile this w/ `normalizedApiError()` and `ensureError()`
// utilities and pull the result into cmd/api.js
function formatAPIErrorMessage(error){
	error = normalizedApiError(error);

	if (error.body){
		if (typeof error.body.error === 'string'){
			error.message = error.body.error;
		} else if (Array.isArray(error.body.errors)){
			if (error.body.errors.length === 1){
				error.message = error.body.errors[0];
			}
		}
	}

	if (error.message.includes('That belongs to someone else.')){
		error.canRequestTransfer = true;
	}

	return error;
}

// TODO (mirande): refactor cmd/api.js to do this check by default when appropriate
function ensureAPIToken(){
	if (!settings.access_token){
		throw new Error(`You're not logged in. Please login using ${chalk.bold.cyan('particle login')} before using this command`);
	}
}
