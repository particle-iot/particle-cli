/**
 ******************************************************************************
 * @file    lib/utilities.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   General Utilities Module
 ******************************************************************************
Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

This program is distributed in the hope utilities it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */


const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const glob = require('glob');
const VError = require('verror');
const childProcess = require('child_process');
const deviceConstants = require('@particle/device-constants');
const { ModuleInfo } = require('binary-version-reader');
const log = require('./log');

const platforms = deviceConstants.filter(p => p.public);
const platformsById = platforms.reduce((map, p) => map.set(p.id, p), new Map());

module.exports = {
	deferredChildProcess(exec){
		return new Promise((resolve, reject) => {
			childProcess.exec(exec, (error, stdout) => {
				if (error){
					reject(error);
				} else {
					resolve(stdout);
				}
			});
		});
	},

	deferredSpawnProcess(exec, args){
		return new Promise((resolve, reject) => {
			try {
				log.verbose('spawning ' + exec + ' ' + args.join(' '));

				let options = {
					stdio: ['ignore', 'pipe', 'pipe']
				};

				let child = childProcess.spawn(exec, args, options);
				let stdout = [],
					errors = [];

				if (child.stdout){
					child.stdout.pipe(log.stdout());
					child.stdout.on('data', (data) => {
						stdout.push(data);
					});
				}

				if (child.stderr){
					child.stderr.pipe(log.stderr());
					child.stderr.on('data', (data) => {
						errors.push(data);
					});
				}

				child.on('close', (code) => {
					let output = { stdout: stdout, stderr: errors };
					if (!code){
						resolve(output);
					} else {
						reject(output);
					}
				});
			} catch (ex){
				console.error('Error during spawn ' + ex);
				reject(ex);
			}
		});
	},

	// TODO (mirande): use util.promisify once node@6 is no longer supported
	readFile(file, options){
		return new Promise((resolve, reject) => {
			fs.readFile(file, options, (error, data) => {
				if (error){
					return reject(error);
				}
				return resolve(data);
			});
		});
	},

	// TODO (mirande): use util.promisify once node@6 is no longer supported
	writeFile(file, data, options){
		return new Promise((resolve, reject) => {
			fs.writeFile(file, data, options, error => {
				if (error){
					return reject(error);
				}
				return resolve();
			});
		});
	},

	filenameNoExt(filename){
		if (!filename || (filename.length === 0)){
			return filename;
		}

		let idx = filename.lastIndexOf('.');
		if (idx >= 0){
			return filename.substr(0, idx);
		} else {
			return filename;
		}
	},

	getFilenameExt(filename){
		if (!filename || (filename.length === 0)){
			return filename;
		}

		let idx = filename.lastIndexOf('.');
		if (idx >= 0){
			return filename.substr(idx);
		} else {
			return filename;
		}
	},

	// TODO (mirande): replace w/ @particle/async-utils
	delay(ms){
		return new Promise((resolve) => setTimeout(resolve, ms));
	},

	// TODO (mirande): replace w/ @particle/async-utils
	asyncReduceSeries(array, fn, initial){
		return array.reduce((promise, current, index, source) => {
			return promise.then((result) => fn(result, current, index, source));
		}, Promise.resolve(initial));
	},

	// TODO (mirande): replace w/ @particle/async-utils
	asyncMapSeries(array, fn){
		const { asyncReduceSeries } = module.exports;
		return asyncReduceSeries(array, async (result, current, index, source) => {
			const value = await fn(current, index, source);
			result.push(value);
			return result;
		}, []);
	},

	// TODO (mirande): replace w/ @particle/async-utils
	enforceTimeout(promise, ms){
		const delay = new Promise((resolve) => setTimeout(resolve, ms).unref());
		const timer = delay.then(() => {
			const error = new Error('The operation timed out :(');
			error.isTimeout = true;
			throw error;
		});

		return Promise.race([promise, timer]);
	},

	async retryDeferred(testFn, numTries, recoveryFn){
		if (!testFn){
			console.error('retryDeferred - comon, pass me a real function.');
			return Promise.reject('not a function!');
		}

		return new Promise((resolve, reject) => {
			let lastError = null;
			let tryTestFn = (async () => {
				numTries--;

				if (numTries < 0){
					return reject(lastError);
				}

				try {
					const value = await Promise.resolve(testFn());
					return resolve(value);
				} catch (error){
					lastError = error;

					if (typeof recoveryFn === 'function'){
						Promise.resolve(recoveryFn()).then(tryTestFn);
					} else {
						tryTestFn();
					}
				}
			})();
		});
	},

	globList(basepath, arr, { followSymlinks } = {}){
		let line, found, files = [];
		for (let i=0;i<arr.length;i++){
			line = arr[i];
			if (basepath){
				line = path.join(basepath, line);
			}
			found = glob.sync(line, { nodir: true, follow: !!followSymlinks });

			if (found && (found.length > 0)){
				files = files.concat(found);
			}
		}
		return files;
	},

	trimBlankLinesAndComments(arr){
		if (arr && (arr.length !== 0)){
			return arr.filter((obj) => {
				return obj && (obj !== '') && (obj.indexOf('#') !== 0);
			});
		}
		return arr;
	},

	readAndTrimLines(file){
		if (!fs.existsSync(file)){
			return null;
		}

		let str = fs.readFileSync(file).toString();
		if (!str){
			return null;
		}

		let arr = str.split('\n');
		if (arr && (arr.length > 0)){
			for (let i = 0; i < arr.length; i++){
				arr[i] = arr[i].trim();
			}
		}
		return arr;
	},

	arrayToHashSet(arr){
		let h = {};
		if (arr) {
			for (let i = 0; i < arr.length; i++) {
				h[arr[i]] = true;
			}
		}
		return h;
	},

	tryParse(str){
		try {
			if (str){
				return JSON.parse(str);
			}
		} catch (ex){
			console.error('tryParse error ', ex);
		}
	},

	/**
	 * replace unfriendly resolution / rejected messages with something nice.
	 *
	 * @param {Promise} promise
	 * @param {*} res
	 * @param {*} err
	 * @returns {Promise} promise, resolving with res, or rejecting with err
	 */
	replaceDfdResults(promise, res, err){
		return Promise.resolve(promise)
			.then(() => res)
			.catch(() => err);
	},

	replaceAll(str, src, dest) {
		return str.split(src).join(dest);
	},

	compliment(arr, excluded){
		const { arrayToHashSet } = module.exports;
		let hash = arrayToHashSet(excluded);

		let result = [];
		for (let i=0;i<arr.length;i++){
			let key = arr[i];
			if (!hash[key]){
				result.push(key);
			}
		}
		return result;
	},

	tryDelete(filename){
		try {
			if (fs.existsSync(filename)){
				fs.unlinkSync(filename);
			}
			return true;
		} catch (ex){
			console.error('error deleting file ' + filename);
		}
		return false;
	},

	__banner: undefined,
	banner(){
		let bannerFile = path.join(__dirname, '../../assets/banner.txt');

		if (module.exports.__banner === undefined){
			try {
				module.exports.__banner = fs.readFileSync(bannerFile, 'utf8');
			} catch (err){
				// ignore missing banner
			}
		}

		return module.exports.__banner;
	},

	// generates an object like { photon: 6, electron: 10 }
	knownPlatformIds(){
		return platforms.reduce((platforms, platform) => {
			platforms[platform.name] = platform.id;
			return platforms;
		}, {});
	},

	// generates an object like { 6: 'Photon', 10: 'Electron' }
	knownPlatformDisplayForId(){
		return platforms.reduce((platforms, platform) => {
			platforms[platform.id] = platform.displayName;
			return platforms;
		}, {});
	},

	/**
	 * Generates a filter function to be used with `Array.filter()` when filtering a list of Devices
	 * by some value. Supports `online`, `offline`, Platform Name, Device ID, or Device Name
	 *
	 * @param {string} filter - Filter value to use for filtering a list of devices
	 * @returns {function|null}
	 */
	buildDeviceFilter(filter) {
		const { knownPlatformIds } = module.exports;
		let filterFunc = null;
		if (filter){
			const platforms = knownPlatformIds();
			if (filter === 'online') {
				filterFunc = (d) => d.connected;
			} else if (filter === 'offline') {
				filterFunc = (d) => !d.connected;
			} else if (Object.keys(platforms).indexOf(filter) >= 0) {
				filterFunc = (d) => d.platform_id === platforms[filter];
			} else {
				filterFunc = (d) => d.id === filter || d.name === filter;
			}
		}
		return filterFunc;
	},

	ensureError(err){
		if (!_.isError(err) && !(err instanceof VError)){
			return new Error(_.isArray(err) ? err.join('\n') : err);
		}
		return err;
	}

	/**
	 * Get the number of the DFU interface that can be used to flash a firmware module of the
	 * specified type.
	 *
	 * @param {Number} moduleFunc The module type as defined by the `FunctionType` enum of the
	 *        binary-version-reader package.
	 * @param {Number} moduleIndex The module index.
	 * @param {Number} platformId The platform ID.
	 * @returns {?Number} The number of the DFU interface or `null` if the module cannot be flashed
	 *          via DFU.
	 */
	dfuInterfaceForFirmwareModule(moduleFunc, moduleIndex, platformId) {
		let modType; // Module type as defined in device-constants
		switch (moduleFunc) {
			case ModuleInfo.FunctionType.SYSTEM_PART:
			case ModuleInfo.FunctionType.MONO_FIRMWARE:
				modType = 'systemPart';
				break;
			case ModuleInfo.FunctionType.USER_PART:
				modType = 'userPart';
				break;
			case ModuleInfo.FunctionType.NCP_FIRMWARE:
				modType = 'ncpFirmware';
				break;
			case ModuleInfo.FunctionType.RADIO_STACK:
				modType = 'radioStack';
				break;
			case ModuleInfo.FunctionType.BOOTLOADER:
			case ModuleInfo.FunctionType.RESOURCE:
			case ModuleInfo.FunctionType.SETTINGS:
				return null;
			default:
				throw new Error('Unknown module type');
		}
		const platform = platformsById.get(platformId);
		if (!platform) {
			throw new Error('Unknown platform');
		}
		const mods = platform.firmwareModules.filter((m) => m.type === modType);
		if (!mods.length) {
			return null;
		}
		let mod;
		if (moduleFunc === ModuleInfo.FunctionType.MONO_FIRMWARE) {
			// It is assumed here that a monolithic firmware uses the same storage as system part modules.
			// As a sanity check, if there are multiple system part modules defined for the platform,
			// ensure that all of them use the same storage
			mod = mod[0];
			if (!mods.every((m) => m.storage === mod.storage)) {
				throw new Error('Cannot determine storage for a monolithic firmware');
			}
		} else if (mods.length === 1) {
			// The module index is optional in device-constants if only one module of the given type is
			// defined for the platform
			mod = mod[0];
			if (mod.index !== undefined && mod.index !== moduleIndex) {
				return null;
			}
		} else {
			mod = mods.find((m) => m.index === moduleIndex);
			if (!mod) {
				return null;
			}
		}
		const storage = platform.dfu.storage.find((s) => s.type === mod.storage);
		if (!storage) {
			return null;
		}
		return storage.alt;
	}
};

