/**
 ******************************************************************************
 * @file    lib/dfu.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   DFU helper module
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

var fs = require('fs');
var when = require('when');
var sequence = require('when/sequence');
var timing = require('./timing.js');
var utilities = require('./utilities.js');
var child_process = require('child_process');
var settings = require('../settings.js');
var specs = require('./deviceSpecs');

var that = module.exports = {

	deviceID: undefined,
	findCompatibleDFU: function () {
		var temp = when.defer();

		var failTimer = utilities.timeoutGenerator("findCompatibleDFU timed out", temp, 6000);
		child_process.exec("dfu-util -l", function (error, stdout, stderr) {
			clearTimeout(failTimer);
			Object.keys(specs).forEach(function (id) {
				if(stdout.indexOf(id) >= 0) {
					console.log("Found DFU device %s", id);
					that.deviceID = id;
					return temp.resolve();
				}
			});
			console.log("Apparently I didn't find a DFU device? util said ", stdout);
			temp.reject("no dfu device found.");
		});

		return temp.promise;
	},

	writeServerKey: function(binaryPath, leave) {
		return that._write(binaryPath, "serverKey", leave);
	},
	writePrivateKey: function(binaryPath, leave) {
		return that._write(binaryPath, "privateKey", leave);
	},
	writeFactoryReset: function(binaryPath, leave) {
		return that._write(binaryPath, "factoryReset", leave);
	},
	writeFirmware: function(binaryPath, leave) {
		return that._write(binaryPath, "userFirmware", leave);
	},

	readServerKey: function(dest, leave) {
		return that._read(dest, "serverKey", leave);
	},
	readPrivateKey: function(dest, leave) {
		return that._read(dest, "privateKey", leave);
	},
	readFactoryReset: function(dest, leave) {
		return that._read(dest, "factoryReset", leave);
	},
	readFirmware: function(dest, leave) {
		return that._read(dest, "userFirmware", leave);
	},

	isDfuUtilInstalled: function() {
		var cmd = "dfu-util -l";
		var installCheck = utilities.deferredChildProcess(cmd);
		return utilities.replaceDfdResults(installCheck, "Installed", "dfu-util is not installed");
	},

	readDfu: function (memoryInterface, destination, firmwareAddress, leave) {
		var prefix = that.getCommandPrefix();
		var leaveStr = (leave) ? ":leave" : "";
		var cmd = prefix + ' -a ' + memoryInterface + ' -s ' + firmwareAddress + leaveStr + ' -U ' + destination;

		return utilities.deferredChildProcess(cmd);
	},

	writeDfu: function (memoryInterface, binaryPath, firmwareAddress, leave) {
		var leaveStr = (leave) ? ":leave" : "";
		var args = [
			"-d", that.deviceID,
			"-a", memoryInterface,
			"-i", "0",
			"-s", firmwareAddress + leaveStr,
			"-D", binaryPath
		];

		that.checkBinaryAlignment("-D " + binaryPath);
		return utilities.deferredSpawnProcess("dfu-util", args);
	},

	getCommandPrefix: function () {
		var sudo = (settings.useSudoForDfu) ? "sudo " : "";
		return sudo + "dfu-util -d " + that.deviceID;
	},

	checkBinaryAlignment: function (cmdargs) {
		var idx = cmdargs.indexOf('-D ');
		if (idx >= 0) {
			var filepath = cmdargs.substr(idx + 3);
			console.log('checking file ', filepath);
			that.appendToEvenBytes(filepath);
		}
		else {
			console.log('uhh, args had no path.');
		}
	},

	/**
	 *
	 * @param filepath
	 */
	appendToEvenBytes: function (filepath) {
		if (fs.existsSync(filepath)) {
			var stats = fs.statSync(filepath);

			//is the filesize even?
			//console.log(filepath, ' stats are ', stats);
			if ((stats.size % 2) != 0) {
				var buf = new Buffer(1);
				buf[0] = 0;

				fs.appendFileSync(filepath, buf);
			}
		}
	},

	_validateSegmentSpecs: function(segmentName) {

		var err = null;
		var deviceSpecs = specs[that.deviceID] || { };
		var params = deviceSpecs[segmentName] || undefined;
		if(!segmentName) { err = "segmentName required. Don't know where to read/write."; }
		else if(!deviceSpecs) { err = "deviceID has no specification. Don't know how to read/write."; }
		else if(!params) { err = "segmentName has no specs. Not aware of this segment."; }

		if(err) { return { error: err, specs: undefined }; }
		return { error: null, specs: params }
	},
	_read: function(destination, segmentName, leave) {

		var address;
		var segment = that._validateSegmentSpecs(segmentName);
		if(segment.error) { throw new Error("dfu._read: " + segment.error); }
		if(segment.specs.size) { address = segment.specs.address + ":" + segment.specs.size; }
		else { address = segment.specs.address; }

		return that.readDfu(
			segment.specs.alt,
			destination,
			address,
			leave
		);
	},
	_write: function(binaryPath, segmentName, leave) {

		var segment = that._validateSegmentSpecs(segmentName);
		if(segment.error) { throw new Error("dfu._write: " + segment.error); }

		return that.writeDfu(
			segment.specs.alt,
			binaryPath,
			segment.specs.address,
			leave
		);
	},

	_: null
};
