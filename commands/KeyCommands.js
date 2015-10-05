/**
 ******************************************************************************
 * @file    commands/KeyCommands.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Key commands module
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
var readline = require('readline');
var settings = require('../settings.js');
var extend = require('xtend');
var util = require('util');
var utilities = require('../lib/utilities.js');
var BaseCommand = require("./BaseCommand.js");
var ApiClient = require('../lib/ApiClient.js');
var moment = require('moment');
//var ursa = require('ursa');
var fs = require('fs');
var path = require('path');
var dfu = require('../lib/dfu.js');

var KeyCommands = function (cli, options) {
	KeyCommands.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
};
util.inherits(KeyCommands, BaseCommand);
KeyCommands.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: "keys",
	description: "tools to help you manage keys on your devices",


	init: function () {

		this.addOption("new", this.makeNewKey.bind(this), "Generate a new set of keys for your device");
		this.addOption("load", this.writeKeyToDevice.bind(this), "Load a saved key on disk onto your device");
		this.addOption("save", this.saveKeyFromDevice.bind(this), "Save a key from your device onto your disk");
		this.addOption("send", this.sendPublicKeyToServer.bind(this), "Tell a server which key you'd like to use by sending your public key");
		this.addOption("doctor", this.keyDoctor.bind(this), "Creates and assigns a new key to your device, and uploads it to the cloud");
		this.addOption("server", this.writeServerPublicKey.bind(this), "Switch server public keys");

		//this.addArgument("get", "--time", "include a timestamp")
		//this.addArgument("monitor", "--time", "include a timestamp")
		//this.addArgument("get", "--all", "gets all variables from the specified deviceid")
		//this.addArgument("monitor", "--all", "gets all variables from the specified deviceid")
		//this.addOption(null, this.helpCommand.bind(this));
	},

	checkArguments: function (args) {
		this.options = this.options || {};

		if (!this.options.force) {
			this.options.force = utilities.tryParseArgs(args,
				"--force",
				null
			);
		}

	},

	makeKeyOpenSSL: function (filename) {
		filename = utilities.filenameNoExt(filename);

		if (this.options.force) {
			utilities.tryDelete(filename + ".pem");
			utilities.tryDelete(filename + ".pub.pem");
			utilities.tryDelete(filename + ".der");
		}

		return sequence([
			function () {
				return utilities.deferredChildProcess("openssl genrsa -out " + filename + ".pem 1024");
			},
			function () {
				return utilities.deferredChildProcess("openssl rsa -in " + filename + ".pem -pubout -out " + filename + ".pub.pem");
			},
			function () {
				return utilities.deferredChildProcess("openssl rsa -in " + filename + ".pem -outform DER -out " + filename + ".der");
			}
		]);
	},

//    makeKeyUrsa: function (filename) {
//        var key = ursa.generatePrivateKey(1024);
//        fs.writeFileSync(filename + ".pem", key.toPrivatePem('binary'));
//        fs.writeFileSync(filename + ".pub.pem", key.toPublicPem('binary'));
//
//        //Hmm... OpenSSL is an installation requirement for URSA anyway, so maybe this fork is totally unnecessary...
//        //in any case, it doesn't look like ursa can do this type conversion, so lets use openssl.
//        return utilities.deferredChildProcess("openssl rsa -in " + filename + ".pem -outform DER -out " + filename + ".der");
//    },


	makeNewKey: function (filename) {
		if (!filename) {
			filename = "device";
		}

		var keyReady = this.makeKeyOpenSSL(filename);

		when(keyReady).then(function () {
			console.log("New Key Created!");
		}, function (err) {
			console.error("Error creating keys... " + err);
		});

		return keyReady;
	},

	writeKeyToDevice: function (filename, leave) {
		this.checkArguments(arguments);

		if (!filename) {
			console.error("Please provide a DER format key filename to load to your device");
			return when.reject("Please provide a DER format key filename to load to your device");
		}

		filename = utilities.filenameNoExt(filename) + ".der";
		if (!fs.existsSync(filename)) {
			console.error("I couldn't find the file: " + filename);
			return when.reject("I couldn't find the file: " + filename);
		}

		//TODO: give the user a warning before doing this, since it'll bump their device offline.
		var that = this;

		var ready = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function () {
				//make sure our device is online and in dfu mode
				return dfu.findCompatibleDFU();
			},
			//backup their existing key so they don't lock themselves out.
			function() {
				var prefilename = path.join(
						path.dirname(filename),
					"pre_" + path.basename(filename)
				);
				return that.saveKeyFromDevice(prefilename).then(null, function(err) {
					console.log('Continuing...');
					// we shouldn't stop this process just because we can't backup the key
					return when.resolve();
				});
			},
			function () {
				return dfu.writePrivateKey(filename, leave);
			}
		]);

		when(ready).then(function () {
			console.log("Saved!");
		}, function (err) {
			console.error("Error saving key to device... " + err);
		});

		return ready;
	},



	saveKeyFromDevice: function (filename) {
		if (!filename) {
			console.error("Please provide a filename to store this key.");
			return when.reject("Please provide a filename to store this key.");
		}

		filename = utilities.filenameNoExt(filename) + ".der";

		this.checkArguments(arguments);

		if ((!this.options.force) && (fs.existsSync(filename))) {
			console.error("This file already exists, please specify a different file, or use the --force flag.");
			return when.reject("This file already exists, please specify a different file, or use the --force flag.");
		}
		else if (fs.existsSync(filename)) {
			utilities.tryDelete(filename);
		}

		//find dfu devices, make sure a device is connected
		//pull the key down and save it there
		var that = this;

		var ready = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function () {
				return dfu.findCompatibleDFU();
			},
			function () {
				//if (that.options.force) { utilities.tryDelete(filename); }
				return dfu.readPrivateKey(filename, false);
			},
			function () {
				var pubPemFilename = utilities.filenameNoExt(filename) + ".pub.pem";
				if (that.options.force) { utilities.tryDelete(pubPemFilename); }
				return utilities.deferredChildProcess("openssl rsa -in " + filename + " -inform DER -pubout  -out " + pubPemFilename).catch(function (err) {
					console.error('Unable to generate public key from the key downloaded from the device. This usually means you had a corrupt key on the device. Error: ', err);
				});
			}
		]);

		when(ready).then(function () {
			console.log("Saved!");
		}, function (err) {
			console.error("Error saving key from device... " + err);
		});

		return ready;
	},

	sendPublicKeyToServer: function (deviceid, filename) {
		if (!deviceid) {
			console.log("Please provide a device id");
			return when.reject("Please provide a device id");
		}

		if (!filename) {
			console.log("Please provide a filename for your device's public key ending in .pub.pem");
			return when.reject("Please provide a filename for your device's public key ending in .pub.pem");
		}

		if (!fs.existsSync(filename)) {
			filename = utilities.filenameNoExt(filename) + ".pub.pem";
			if (!fs.existsSync(filename)) {
				console.error("Couldn't find " + filename);
				return when.reject("Couldn't find " + filename);
			}
		}

		var api = new ApiClient(settings.apiUrl, settings.access_token);
		if (!api.ready()) {
			return when.reject("Not logged in");
		}

		var keyStr = fs.readFileSync(filename).toString();
		return api.sendPublicKey(deviceid, keyStr);
	},

	keyDoctor: function (deviceid) {
		if (!deviceid || (deviceid == "")) {
			console.log("Please provide your device id");
			return 0;
		}

		this.checkArguments(arguments);

		if (deviceid.length < 24) {
			console.log("***************************************************************");
			console.log("   Warning! - device id was shorter than 24 characters - did you use something other than an id?");
			console.log("   use particle identify to find your device id");
			console.log("***************************************************************");
		}

		var that = this;
		var allDone = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function () {
				return dfu.findCompatibleDFU();
			},
			function() {
				return that.makeNewKey(deviceid + "_new");
			},
			function() {
				return that.writeKeyToDevice(deviceid + "_new", true);
			},
			function() {
				return that.sendPublicKeyToServer(deviceid, deviceid + "_new");
			}
		]);

		when(allDone).then(
			function () {
				console.log("Okay!  New keys in place, your device should restart.");

			},
			function (err) {
				console.log("Make sure your device is in DFU mode (blinking yellow), and that your computer is online.");
				console.error("Error - " + err);
			});
	},

	writeServerPublicKey: function (filename, ipOrDomain) {
		if (!filename || (!fs.existsSync(filename))) {
			console.log("Please specify a server key in DER format.");
			return -1;
		}

		if (utilities.getFilenameExt(filename).toLowerCase() != ".der") {
			var derFile = utilities.filenameNoExt(filename) + ".der";

			if (!fs.existsSync(derFile)) {
				var that = this;
				console.log("Creating DER format file");
				var derFilePromise = utilities.deferredChildProcess("openssl rsa -in  " + filename + " -pubin -pubout -outform DER -out " + derFile);
				when(derFilePromise).then(function() {
					that.writeServerPublicKey(derFile, ipOrDomain);
				}, function(err) {
					console.error("Error creating a DER formatted version of that key.  Make sure you specified the public key: " + err);
				});

				return;
			}
			else {
				filename = derFile;
			}
		}

		if (ipOrDomain == "mine") {
			var ips = utilities.getIPAddresses();
			if (ips && (ips.length == 1)) {
				ipOrDomain = ips[0];
			}
			else if (ips.length > 0) {
				console.log("Please specify an ip address: " + ips.join("\n"));
				return;
			}
		}


		if (ipOrDomain) {
			var isIpAddress = /^[0-9.]*$/.test(ipOrDomain);

			var file_with_address = utilities.filenameNoExt(filename) + utilities.replaceAll(ipOrDomain, ".", "_") + ".der";
			if (!fs.existsSync(file_with_address)) {
				// create a version of this key that points to a particular server or domain
				var addressBuf = new Buffer(ipOrDomain.length + 2);
				addressBuf[0] = (isIpAddress) ? 0 : 1;
				addressBuf[1] = (isIpAddress) ? 4 : ipOrDomain.length;

				if (isIpAddress) {
					var parts = ipOrDomain.split('.').map(function (obj) {
						return parseInt(obj);
					});
					addressBuf[2] = parts[0];
					addressBuf[3] = parts[1];
					addressBuf[4] = parts[2];
					addressBuf[5] = parts[3];
				}
				else {
					addressBuf.write(ipOrDomain, 2);
				}

				// To generate a file like this, just add a type-length-value (TLV) encoded IP or domain beginning 384 bytes into the file—on external flash the address begins at 0x1180.
				// Everything between the end of the key and the beginning of the address should be 0xFF.
				// The first byte representing "type" is 0x00 for 4-byte IP address or 0x01 for domain name—anything else is considered invalid and uses the fallback domain.
				// The second byte is 0x04 for an IP address or the length of the string for a domain name.
				// The remaining bytes are the IP or domain name. If the length of the domain name is odd, add a zero byte to get the file length to be even as usual.


				var buf = new Buffer(1024);

				//copy in the key
				var fileBuf = fs.readFileSync(filename);
				fileBuf.copy(buf, 0, 0, fileBuf.length);

				//fill the rest with "FF"
				buf.fill(255, fileBuf.length);

				addressBuf.copy(buf, 384, 0, addressBuf.length);

				//console.log("address chunk is now: " + addressBuf.toString('hex'));
				//console.log("Key chunk is now: " + buf.toString('hex'));

				fs.writeFileSync(file_with_address, buf);
			}
			filename = file_with_address;
		}


		var allDone = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function() {
				return dfu.findCompatibleDFU();
			},
			function() {
				return dfu.writeServerKey(filename, false);
			}
		]);

		when(allDone).then(
			function () {
				console.log("Okay!  New keys in place, your device will not restart.");

			},
			function (err) {
				console.log("Make sure your device is in DFU mode (blinking yellow), and is connected to your computer");
				console.error("Error - " + err);
			});
	},


	_: null
});

module.exports = KeyCommands;
