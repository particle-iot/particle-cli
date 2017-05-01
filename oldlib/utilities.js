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

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */
'use strict';

var os = require('os');
var fs = require('fs');
var path = require('path');
var when = require('when');
var child_process = require('child_process');
var log = require('./log');
var utilities = require('particle-commands').utilities;

var that = module.exports = {
	contains: function(arr, obj) {
		return (that.indexOf(arr, obj) >= 0);
	},
	containsKey: function(arr, obj) {
		if (!arr) {
			return false;
		}

		return that.contains(Object.keys(arr), obj);
	},
	indexOf: function(arr, obj) {
		if (!arr || (arr.length === 0)) {
			return -1;
		}

		for (var i=0;i<arr.length;i++) {
			if (arr[i] === obj) {
				return i;
			}
		}

		return -1;
	},
	// String.endsWith polyfill
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith#Polyfill
	endsWith: function(subject, searchString, position) {
		var subjectString = subject.toString();
		if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
			position = subjectString.length;
		}
		position -= searchString.length;
		var lastIndex = subjectString.lastIndexOf(searchString, position);
		return lastIndex !== -1 && lastIndex === position;
	},
	pipeDeferred: function(left, right) {
		return when(left).then(function() {
			right.resolve.apply(right, arguments);
		}, function() {
			right.reject.apply(right, arguments);
		});
	},

	deferredChildProcess: function(exec) {
		var tmp = when.defer();

		child_process.exec(exec, function(error, stdout) {
			if (error) {
				tmp.reject(error);
			} else {
				tmp.resolve(stdout);
			}
		});

		return tmp.promise;
	},

	deferredSpawnProcess: function(exec, args) {
		var tmp = when.defer();
		try {
			log.verbose('spawning ' + exec + ' ' + args.join(' '));

			var options = {
				stdio: ['ignore', 'pipe', 'pipe']
			};

			var child = child_process.spawn(exec, args, options);
			var stdout = [],
				errors = [];

			if (child.stdout) {
				child.stdout.pipe(log.stdout());
				child.stdout.on('data', function (data) {
					stdout.push(data);
				});
			}

			if (child.stderr) {
				child.stderr.pipe(log.stderr());
				child.stderr.on('data', function (data) {
					errors.push(data);
				});
			}

			child.on('close', function (code) {
				var output = { stdout: stdout, stderr: errors };
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

	filenameNoExt: function (filename) {
		if (!filename || (filename.length === 0)) {
			return filename;
		}

		var idx = filename.lastIndexOf('.');
		if (idx >= 0) {
			return filename.substr(0, idx);
		} else {
			return filename;
		}
	},
	getFilenameExt: function (filename) {
		if (!filename || (filename.length === 0)) {
			return filename;
		}

		var idx = filename.lastIndexOf('.');
		if (idx >= 0) {
			return filename.substr(idx);
		} else {
			return filename;
		}
	},

	timeoutGenerator: function (msg, defer, delay) {
		return setTimeout(function () {
			defer.reject(msg);
		}, delay);
	},

	indentLeft: function(str, char, len) {
		var extra = [];
		for (var i=0;i<len;i++) {
			extra.push(char);
		}
		return extra.join('') + str;
	},

	indentLines: function (arr, char, len) {
		var extra = [];
		for (var i = 0; i < arr.length; i++) {
			extra.push(that.indentLeft(arr[i], char, len));
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
	padLeft: function(str, char, len) {
		var delta = len - str.length;
		var extra = [];
		for (var i=0;i<delta;i++) {
			extra.push(char);
		}
		return extra.join('') + str;
	},

	padRight: function(str, char, len) {
		var delta = len - str.length;
		var extra = [];
		for (var i=0;i<delta;i++) {
			extra.push(char);
		}
		return str + extra.join('');
	},

	wrapArrayText: function(arr, maxLength, delim) {
		var lines = [];
		var line = '';
		delim = delim || ', ';

		for (var i=0;i<arr.length;i++) {
			var str = arr[i];
			var newLength = line.length + str.length + delim.length;

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


	retryDeferred: function (testFn, numTries, recoveryFn) {
		if (!testFn) {
			console.error('retryDeferred - comon, pass me a real function.');
			return when.reject('not a function!');
		}

		var defer = when.defer(),
			lastError = null,
			tryTestFn = function () {
				numTries--;
				if (numTries < 0) {
					defer.reject('Out of tries ' + lastError);
					return;
				}

				try {
					when(testFn()).then(
						function (value) {
							defer.resolve(value);
						},
						function (msg) {
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

	isDirectory: function(somepath) {
		if (fs.existsSync(somepath)) {
			return fs.statSync(somepath).isDirectory();
		}
		return false;
	},

	fixRelativePaths: function (dirname, files) {
		if (!files || (files.length === 0)) {
			return null;
		}

		//convert to absolute paths, and return!
		return files.map(function (obj) {
			return path.join(dirname, obj);
		});
	},

	/**
	 * for a given list of absolute filenames, identify directories,
	 * and add them to the end of the list.
	 * @param {Array} files
	 * @returns {Array} array of files contained within subdirectories
	 */
	expandSubdirectories: function(files) {
		if (!files || (files.length === 0)) {
			return files;
		}

		var result = [];

		for (var i=0;i<files.length;i++) {
			var filename = files[0];
			var stats = fs.statSync(filename);
			if (!stats.isDirectory()) {
				result.push(filename);
			} else {
				var arr = that.recursiveListFiles(filename);
				if (arr) {
					result = result.concat(arr);
				}
			}
		}
		return result;
	},

	globList: utilities.globList,

	trimBlankLines: function (arr) {
		if (arr && (arr.length !== 0)) {
			return arr.filter(function (obj) {
				return obj && (obj !== '');
			});
		}
		return arr;
	},

	trimBlankLinesAndComments: function (arr) {
		if (arr && (arr.length !== 0)) {
			return arr.filter(function (obj) {
				return obj && (obj !== '') && (obj.indexOf('#') !== 0);
			});
		}
		return arr;
	},

	readLines: function(file) {
		if (fs.existsSync(file)) {
			var str = fs.readFileSync(file).toString();
			if (str) {
				return str.split('\n');
			}
		}

		return null;
	},

	readAndTrimLines: function(file) {
		if (!fs.existsSync(file)) {
			return null;
		}

		var str = fs.readFileSync(file).toString();
		if (!str) {
			return null;
		}

		var arr = str.split('\n');
		if (arr && (arr.length > 0)) {
			for (var i = 0; i < arr.length; i++) {
				arr[i] = arr[i].trim();
			}
		}
		return arr;
	},

	arrayToHashSet: function (arr) {
		var h = {};
		if (arr) {
			for (var i = 0; i < arr.length; i++) {
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
	recursiveListFiles: function (dir, excludedDirs) {
		excludedDirs = excludedDirs || [];

		var result = [];
		var files = fs.readdirSync(dir);
		for (var i = 0; i < files.length; i++) {
			var fullpath = path.join(dir, files[i]);
			var stat = fs.statSync(fullpath);
			if (stat.isDirectory()) {
				if (!excludedDirs.contains(fullpath)) {
					result = result.concat(that.recursiveListFiles(fullpath, excludedDirs));
				}
			} else {
				result.push(fullpath);
			}
		}
		return result;
	},

	tryParseArgs: function (args, name, errText) {
		var idx = that.indexOf(args, name);
		var result;
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

	copyArray: function(arr) {
		var result = [];
		for (var i=0;i<arr.length;i++) {
			result.push(arr[i]);
		}
		return result;
	},

	countHashItems: function(hash) {
		var count = 0;
		if (hash) {
			return Object.keys(hash).length;
		}
		return count;
	},
	replaceAll: function(str, src, dest) {
		return str.split(src).join(dest);
	},

	getIPAddresses: function () {
		//adapter = adapter || "eth0";
		var results = [];
		var nics = os.networkInterfaces();

		for (var name in nics) {
			var nic = nics[name];

			for (var i = 0; i < nic.length; i++) {
				var addy = nic[i];

				if ((addy.family !== 'IPv4') || (addy.address === '127.0.0.1')) {
					continue;
				}

				results.push(addy.address);
			}
		}

		return results;
	},

	tryStringify: function(obj) {
		try {
			if (obj) {
				return JSON.stringify(obj);
			}
		} catch (ex) {
			console.error('stringify error ', ex);
		}
	},

	tryParse: function(str) {
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
	replaceDfdResults: function(promise, res, err) {
		var dfd = when.defer();

		when(promise).then(function() {
			dfd.resolve(res);
		}, function() {
			dfd.reject(err);
		});

		return dfd.promise;
	},

	compliment: function(arr, excluded) {
		var hash = that.arrayToHashSet(excluded);

		var result = [];
		for (var i=0;i<arr.length;i++) {
			var key = arr[i];
			if (!hash[key]) {
				result.push(key);
			}
		}
		return result;
	},

	tryDelete: function(filename) {
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

	resolvePaths: function(basepath, files) {
		for (var i=0;i<files.length;i++) {
			files[i] = path.join(basepath, files[i]);
		}
		return files;
	},

	__banner: undefined,

	banner: function() {
		var bannerFile = path.join(__dirname, 'banner.txt');
		if (this.__banner===undefined) {
			try {
				this.__banner = fs.readFileSync(bannerFile, 'utf8');
			} catch (err) {
				// ignore missing banner
			}
		}
		return this.__banner;
	},

	// todo - factor from/to constants.js, also in settings.js
	knownPlatforms: function knownPlatforms() {
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


	cellularOtaUsage: function(fileSize) {
		var numChunks = Math.ceil(fileSize / 512);
		var perChunkOverhead = (16+29+28);
		var controlOverhead = 48 + (6*(29+28));
		var totalBytes = (numChunks * perChunkOverhead) + controlOverhead + fileSize;

		return (totalBytes / 1E6).toFixed(3);
	}
};
