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


const os = require('os');
const fs = require('fs');
const path = require('path');
const when = require('when');
const childProcess = require('child_process');
const glob = require('glob');
const _ = require('lodash');
const VError = require('verror');
const log = require('./log');

const utilities = {
	contains(arr, obj) {
		return (utilities.indexOf(arr, obj) >= 0);
	},
	containsKey(arr, obj) {
		if (!arr) {
			return false;
		}

		return utilities.contains(Object.keys(arr), obj);
	},
	indexOf(arr, obj) {
		if (!arr || (arr.length === 0)) {
			return -1;
		}

		for (let i=0;i<arr.length;i++) {
			if (arr[i] === obj) {
				return i;
			}
		}

		return -1;
	},
	// String.endsWith polyfill
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith#Polyfill
	endsWith(subject, searchString, position) {
		let subjectString = subject.toString();
		if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
			position = subjectString.length;
		}
		position -= searchString.length;
		let lastIndex = subjectString.lastIndexOf(searchString, position);
		return lastIndex !== -1 && lastIndex === position;
	},
	pipeDeferred(left, right) {
		return when(left).then(() => {
			right.resolve.apply(right, arguments);
		}, () => {
			right.reject.apply(right, arguments);
		});
	},

	deferredChildProcess(exec) {
		let tmp = when.defer();

		childProcess.exec(exec, (error, stdout) => {
			if (error) {
				tmp.reject(error);
			} else {
				tmp.resolve(stdout);
			}
		});

		return tmp.promise;
	},

	deferredSpawnProcess(exec, args) {
		let tmp = when.defer();
		try {
			log.verbose('spawning ' + exec + ' ' + args.join(' '));

			let options = {
				stdio: ['ignore', 'pipe', 'pipe']
			};

			let child = childProcess.spawn(exec, args, options);
			let stdout = [],
				errors = [];

			if (child.stdout) {
				child.stdout.pipe(log.stdout());
				child.stdout.on('data', (data) => {
					stdout.push(data);
				});
			}

			if (child.stderr) {
				child.stderr.pipe(log.stderr());
				child.stderr.on('data', (data) => {
					errors.push(data);
				});
			}

			child.on('close', (code) => {
				let output = { stdout: stdout, stderr: errors };
				if (!code) {
					tmp.resolve(output);
				} else {
					tmp.reject(output);
				}
			});
		} catch (ex) {
			console.error('Error during spawn ' + ex);
			tmp.reject(ex);
		}
		return tmp.promise;
	},

	filenameNoExt(filename) {
		if (!filename || (filename.length === 0)) {
			return filename;
		}

		let idx = filename.lastIndexOf('.');
		if (idx >= 0) {
			return filename.substr(0, idx);
		} else {
			return filename;
		}
	},
	getFilenameExt(filename) {
		if (!filename || (filename.length === 0)) {
			return filename;
		}

		let idx = filename.lastIndexOf('.');
		if (idx >= 0) {
			return filename.substr(idx);
		} else {
			return filename;
		}
	},

	timeoutGenerator(msg, defer, delay) {
		return setTimeout(() => {
			defer.reject(msg);
		}, delay);
	},

	indentLeft(str, char, len) {
		let extra = [];
		for (let i=0;i<len;i++) {
			extra.push(char);
		}
		return extra.join('') + str;
	},

	indentLines(arr, char, len) {
		let extra = [];
		for (let i = 0; i < arr.length; i++) {
			extra.push(utilities.indentLeft(arr[i], char, len));
		}
		return extra.join('\n');
	},

	/**
	 * pad the left side of "str" with "char" until it's length "len"
	 * @param {String} str
	 * @param {String} char
	 * @param {Number} len
	 * @returns {String} string padded with char
	 */
	padLeft(str, char, len) {
		let delta = len - str.length;
		let extra = [];
		for (let i=0;i<delta;i++) {
			extra.push(char);
		}
		return extra.join('') + str;
	},

	padRight(str, char, len) {
		let delta = len - str.length;
		let extra = [];
		for (let i=0;i<delta;i++) {
			extra.push(char);
		}
		return str + extra.join('');
	},

	wrapArrayText(arr, maxLength, delim) {
		let lines = [];
		let line = '';
		delim = delim || ', ';

		for (let i=0;i<arr.length;i++) {
			let str = arr[i];
			let newLength = line.length + str.length + delim.length;

			if (newLength >= maxLength) {
				lines.push(line);
				line = '';
			}

			if (line.length > 0) {
				line += delim;
			}
			line += str;
		}
		if (line !== '') {
			lines.push(line);
		}


		return lines;
	},


	retryDeferred(testFn, numTries, recoveryFn) {
		if (!testFn) {
			console.error('retryDeferred - comon, pass me a real function.');
			return when.reject('not a function!');
		}

		let defer = when.defer();
		let lastError = null;
		let tryTestFn = () => {
			numTries--;
			if (numTries < 0) {
				defer.reject('Out of tries ' + lastError);
				return;
			}

			try {
				when(testFn()).then(
						(value) => {
							defer.resolve(value);
						},
						(msg) => {
							lastError = msg;

							if (recoveryFn) {
								when(recoveryFn()).then(tryTestFn);
							} else {
								tryTestFn();
							}
						});
			} catch (ex) {
				lastError = ex;
			}
		};

		tryTestFn();
		return defer.promise;
	},

	isDirectory(somepath) {
		if (fs.existsSync(somepath)) {
			return fs.statSync(somepath).isDirectory();
		}
		return false;
	},

	fixRelativePaths(dirname, files) {
		if (!files || (files.length === 0)) {
			return null;
		}

		//convert to absolute paths, and return!
		return files.map((obj) => {
			return path.join(dirname, obj);
		});
	},

	/**
	 * for a given list of absolute filenames, identify directories,
	 * and add them to the end of the list.
	 * @param {Array} files
	 * @returns {Array} array of files contained within subdirectories
	 */
	expandSubdirectories(files) {
		if (!files || (files.length === 0)) {
			return files;
		}

		let result = [];

		for (let i=0;i<files.length;i++) {
			let filename = files[0];
			let stats = fs.statSync(filename);
			if (!stats.isDirectory()) {
				result.push(filename);
			} else {
				let arr = utilities.recursiveListFiles(filename);
				if (arr) {
					result = result.concat(arr);
				}
			}
		}
		return result;
	},

	globList(basepath, arr) {
		let line, found, files = [];
		for (let i=0;i<arr.length;i++) {
			line = arr[i];
			if (basepath) {
				line = path.join(basepath, line);
			}
			found = glob.sync(line, { nodir: true });

			if (found && (found.length > 0)) {
				files = files.concat(found);
			}
		}
		return files;
	},

	trimBlankLines(arr) {
		if (arr && (arr.length !== 0)) {
			return arr.filter((obj) => {
				return obj && (obj !== '');
			});
		}
		return arr;
	},

	trimBlankLinesAndComments(arr) {
		if (arr && (arr.length !== 0)) {
			return arr.filter((obj) => {
				return obj && (obj !== '') && (obj.indexOf('#') !== 0);
			});
		}
		return arr;
	},

	readLines(file) {
		if (fs.existsSync(file)) {
			let str = fs.readFileSync(file).toString();
			if (str) {
				return str.split('\n');
			}
		}

		return null;
	},

	readAndTrimLines(file) {
		if (!fs.existsSync(file)) {
			return null;
		}

		let str = fs.readFileSync(file).toString();
		if (!str) {
			return null;
		}

		let arr = str.split('\n');
		if (arr && (arr.length > 0)) {
			for (let i = 0; i < arr.length; i++) {
				arr[i] = arr[i].trim();
			}
		}
		return arr;
	},

	arrayToHashSet(arr) {
		let h = {};
		if (arr) {
			for (let i = 0; i < arr.length; i++) {
				h[arr[i]] = true;
			}
		}
		return h;
	},

	/**
	 * recursively create a list of all files in a directory and all subdirectories,
	 * potentially excluding certain directories
	 * @param {String} dir
	 * @param {Array} excludedDirs
	 * @returns {Array} array of all filenames
	 */
	recursiveListFiles(dir, excludedDirs) {
		excludedDirs = excludedDirs || [];

		let result = [];
		let files = fs.readdirSync(dir);
		for (let i = 0; i < files.length; i++) {
			let fullpath = path.join(dir, files[i]);
			let stat = fs.statSync(fullpath);
			if (stat.isDirectory()) {
				if (!excludedDirs.contains(fullpath)) {
					result = result.concat(utilities.recursiveListFiles(fullpath, excludedDirs));
				}
			} else {
				result.push(fullpath);
			}
		}
		return result;
	},

	tryParseArgs(args, name, errText) {
		let idx = utilities.indexOf(args, name);
		let result;
		if (idx >= 0) {
			result = true;
			if ((idx + 1) < args.length) {
				result = args[idx + 1];
			} else if (errText) {
				console.log(errText);
			}
		}
		return result;
	},

	copyArray(arr) {
		let result = [];
		for (let i=0;i<arr.length;i++) {
			result.push(arr[i]);
		}
		return result;
	},

	countHashItems(hash) {
		let count = 0;
		if (hash) {
			return Object.keys(hash).length;
		}
		return count;
	},
	replaceAll(str, src, dest) {
		return str.split(src).join(dest);
	},

	getIPAddresses() {
		//adapter = adapter || "eth0";
		let results = [];
		let nics = os.networkInterfaces();

		for (let name in nics) {
			let nic = nics[name];

			for (let i = 0; i < nic.length; i++) {
				let addy = nic[i];

				if ((addy.family !== 'IPv4') || (addy.address === '127.0.0.1')) {
					continue;
				}

				results.push(addy.address);
			}
		}

		return results;
	},

	tryStringify(obj) {
		try {
			if (obj) {
				return JSON.stringify(obj);
			}
		} catch (ex) {
			console.error('stringify error ', ex);
		}
	},

	tryParse(str) {
		try {
			if (str) {
				return JSON.parse(str);
			}
		} catch (ex) {
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
	replaceDfdResults(promise, res, err) {
		let dfd = when.defer();

		when(promise).then(() => {
			dfd.resolve(res);
		}, () => {
			dfd.reject(err);
		});

		return dfd.promise;
	},

	compliment(arr, excluded) {
		let hash = utilities.arrayToHashSet(excluded);

		let result = [];
		for (let i=0;i<arr.length;i++) {
			let key = arr[i];
			if (!hash[key]) {
				result.push(key);
			}
		}
		return result;
	},

	tryDelete(filename) {
		try {
			if (fs.existsSync(filename)) {
				fs.unlinkSync(filename);
			}
			return true;
		} catch (ex) {
			console.error('error deleting file ' + filename);
		}
		return false;
	},

	resolvePaths(basepath, files) {
		for (let i=0;i<files.length;i++) {
			files[i] = path.join(basepath, files[i]);
		}
		return files;
	},

	__banner: undefined,

	banner() {
		let bannerFile = path.join(__dirname, '../../assets/banner.txt');
		if (this.__banner===undefined) {
			try {
				this.__banner = fs.readFileSync(bannerFile, 'utf8');
			} catch (err) {
				// ignore missing banner
			}
		}
		return this.__banner;
	},

	// todo - factor from/to constants.js
	knownPlatforms() {
		return {
			'core': 0,
			'photon': 6,
			'p1': 8,
			'electron': 10,
			'raspberrypi': 31,
			'oak': 82,
			'duo': 88,
			'bluz': 103,
			'bluz-gateway': 269,
			'bluz-beacon': 270
		};
	},


	cellularOtaUsage(fileSize) {
		let numChunks = Math.ceil(fileSize / 512);
		let perChunkOverhead = (16+29+28);
		let controlOverhead = 48 + (6*(29+28));
		let totalBytes = (numChunks * perChunkOverhead) + controlOverhead + fileSize;

		return (totalBytes / 1E6).toFixed(3);
	},

	ensureError(err) {
		if (!_.isError(err) && !err instanceof VError) {
			return new Error(_.isArray(err) ? err.join('\n') : err);
		}
		return err;
	}
};
module.exports = utilities;
