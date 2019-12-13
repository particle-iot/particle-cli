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
const log = require('./log');


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

	// todo - factor from/to constants.js
	knownPlatforms(){
		return {
			'core': 0,
			'photon': 6,
			'p1': 8,
			'electron': 10,
			'raspberrypi': 31,
			'argon': 12,
			'boron': 13,
			'xenon': 14,
			'asom': 22,
			'bsom': 23,
			'xsom': 24,
			'b5som': 25,
			'oak': 82,
			'duo': 88,
			'bluz': 103,
			'bluz-gateway': 269,
			'bluz-beacon': 270
		};
	},

	ensureError(err){
		if (!_.isError(err) && !(err instanceof VError)){
			return new Error(_.isArray(err) ? err.join('\n') : err);
		}
		return err;
	}
};

