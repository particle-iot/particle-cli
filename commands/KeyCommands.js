/**
 ******************************************************************************
 * @file    commands/KeyCommands.js
 * @author  David Middlecamp (david@particle.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Key commands module
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

var url = require('url');
var when = require('when');
var whenNode = require('when/node');
var sequence = require('when/sequence');
var pipeline = require('when/pipeline');
var temp = require('temp').track();
var extend = require('xtend');
var util = require('util');
var utilities = require('../dist/lib/utilities.js');
var BaseCommand = require('./BaseCommand.js');
var ApiClient = require('../dist/lib/ApiClient.js');
var fs = require('fs');
var path = require('path');
var dfu = require('../dist/lib/dfu.js');
var deviceSpecs = require('../dist/lib/deviceSpecs');

/**
 * Commands for managing encryption keys.
 * For devices that support a single protocol, the
 * key type defaults to that. For devices that support multiple
 * protcools, the `--protocol` flag can be used to
 * specify the protocol. When omitted, the current configured
 * protocol on the device is used.
 * @constructor
 */
function KeyCommands(cli, options) {
	KeyCommands.super_.call(this, cli, options);
	this.options = extend({}, this.options, options);

	this.init();
}
util.inherits(KeyCommands, BaseCommand);
KeyCommands.prototype = extend(BaseCommand.prototype, {
	options: null,
	name: 'keys',
	description: 'tools to help you manage keys on your devices',

	init: function () {
		this.dfu = dfu;
		this.addOption('new', this.makeNewKey.bind(this), 'Generate a new set of keys for your device');
		this.addOption('load', this.writeKeyToDevice.bind(this), 'Load a saved key on disk onto your device');
		this.addOption('save', this.saveKeyFromDevice.bind(this), 'Save a key from your device onto your disk');
		this.addOption('send', this.sendPublicKeyToServer.bind(this), "Tell a server which key you'd like to use by sending your public key");
		this.addOption('doctor', this.keyDoctor.bind(this), 'Creates and assigns a new key to your device, and uploads it to the cloud');
		this.addOption('server', this.writeServerPublicKey.bind(this), 'Switch server public keys');
		this.addOption('address', this.readServerAddress.bind(this), 'Read server configured in device server public key');
		this.addOption('protocol', this.transportProtocol.bind(this), 'Retrieve or change transport protocol the device uses to communicate with the cloud');
	},

	checkArguments: function (args) {
		this.options = this.options || {};
		args = Array.prototype.slice.call(args);

		if (!this.options.force) {
			this.options.force = utilities.tryParseArgs(args,
				'--force',
				null
			);
		}

		if (!this.options.protocol) {
			this.options.protocol = utilities.tryParseArgs(args,
				'--protocol',
				null
			);
		}

		if (!this.options.productId) {
			this.options.productId = utilities.tryParseArgs(args,
				'--product_id',
				null
			);
		}
	},

	transportProtocol: function(protocol) {
		return protocol ? this.changeTransportProtocol(protocol) : this.showTransportProtocol();
	},

	showTransportProtocol: function() {
		var dfu = this.dfu;
		var self = this;
		var fetch = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function() {
				//make sure our device is online and in dfu mode
				return dfu.findCompatibleDFU();
			},
			function() {
				return self.validateDeviceProtocol();
			}
		]);

		return fetch.then(function(protocol) {
			console.log('Device protocol is set to '+self.options.protocol);
		}).catch(function(err) {
			console.log('Error', err);
		});
	},

	changeTransportProtocol: function(protocol) {
		var dfu = this.dfu;
		if (protocol !== 'udp' && protocol !== 'tcp') {
			console.log('Invalid protocol');
			return -1;
		}

		var changed = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function() {
				//make sure our device is online and in dfu mode
				return dfu.findCompatibleDFU();
			},
			function() {
				var specs = deviceSpecs[dfu.dfuId];
				if (!specs.transport) {
					return when.reject('No transport flag available');
				}

				var flagValue = specs.defaultProtocol === protocol ? new Buffer([255]) : new Buffer([0]);
				return dfu.writeBuffer(flagValue, 'transport', false);
			}
		]);

		changed.then(function() {
			console.log('Protocol changed to '+protocol);
		}).catch(function(err) {
			console.log('Error', err);
		});
		return changed;
	},

	makeKeyOpenSSL: function (filename, alg) {
		filename = utilities.filenameNoExt(filename);

		if (this.options.force) {
			utilities.tryDelete(filename + '.pem');
			utilities.tryDelete(filename + '.pub.pem');
			utilities.tryDelete(filename + '.der');
		}

		alg = alg || this._getPrivateKeyAlgorithm();

		return sequence([
			function () {
				if (alg === 'rsa') {
					return utilities.deferredChildProcess('openssl genrsa -out ' + filename + '.pem 1024');
				} else if (alg === 'ec') {
					return utilities.deferredChildProcess('openssl ecparam -name prime256v1 -genkey -out ' + filename + '.pem');
				}
			},
			function () {
				return utilities.deferredChildProcess('openssl ' + alg + ' -in ' + filename + '.pem -pubout -out ' + filename + '.pub.pem');
			},
			function () {
				return utilities.deferredChildProcess('openssl ' + alg + ' -in ' + filename + '.pem -outform DER -out ' + filename + '.der');
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
		this.checkArguments(arguments);
		if (!filename || filename === '--protocol') {
			filename = 'device';
		}

		return this._makeNewKey(filename);
	},

	keyAlgorithmForProtocol: function (protocol) {
		return protocol === 'udp' ? 'ec' : 'rsa';
	},

	_makeNewKey: function(filename) {
		var dfu = this.dfu;
		var self = this;
		var alg;
		var showHelp = !self.options.protocol;
		var keyReady = sequence([
			function() {
				return sequence([
					dfu.isDfuUtilInstalled.bind(dfu),
					dfu.findCompatibleDFU.bind(dfu, showHelp)
				]).catch(function(err) {
					if (self.options.protocol) {
						alg = self.keyAlgorithmForProtocol(self.options.protocol);
						return when.resolve();
					}
					return when.reject(err);
				});
			},
			function() {
				return self.makeKeyOpenSSL(filename, alg);
			}
		]);

		keyReady.then(function () {
			console.log('New Key Created!');
		}, function (err) {
			console.error('Error creating keys... ' + err);
		});

		return keyReady;
	},

	writeKeyToDevice: function (filename, leave) {
		var dfu = this.dfu;
		this.checkArguments(arguments);

		if (!filename) {
			console.error('Please provide a DER format key filename to load to your device');
			return when.reject('Please provide a DER format key filename to load to your device');
		}

		filename = utilities.filenameNoExt(filename) + '.der';
		if (!fs.existsSync(filename)) {
			console.error("I couldn't find the file: " + filename);
			return when.reject("I couldn't find the file: " + filename);
		}

		//TODO: give the user a warning before doing this, since it'll bump their device offline.
		var self = this;

		var ready = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function () {
				//make sure our device is online and in dfu mode
				return dfu.findCompatibleDFU();
			},
			function () {
				return self.validateDeviceProtocol();
			},
			//backup their existing key so they don't lock themselves out.
			function() {
				var alg = self._getPrivateKeyAlgorithm();
				var prefilename = path.join(
						path.dirname(filename),
					'backup_' + alg + '_' + path.basename(filename)
				);
				return self.saveKeyFromDevice(prefilename).then(null, function() {
					console.log('Continuing...');
					// we shouldn't stop this process just because we can't backup the key
					return when.resolve();
				});
			},
			function () {
				var segment = self._getPrivateKeySegmentName();
				return dfu.write(filename, segment, leave);
			}
		]);

		ready.then(function () {
			console.log('Saved!');
		}, function (err) {
			console.error('Error saving key to device... ' + err);
		});

		return ready;
	},

	saveKeyFromDevice: function (filename) {
		var dfu = this.dfu;
		if (!filename) {
			console.error('Please provide a filename to store this key.');
			return when.reject('Please provide a filename to store this key.');
		}

		filename = utilities.filenameNoExt(filename) + '.der';

		this.checkArguments(arguments);

		if ((!this.options.force) && (fs.existsSync(filename))) {
			var msg = 'This file already exists, please specify a different file, or use the --force flag.';
			// todo - surely exceptions are also logged too? do we need the console output?
			console.error(msg);
			return when.reject(msg);
		} else if (fs.existsSync(filename)) {
			utilities.tryDelete(filename);
		}

		//find dfu devices, make sure a device is connected
		//pull the key down and save it there
		var self = this;

		var ready = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function () {
				return dfu.findCompatibleDFU();
			},
			function () {
				return self.validateDeviceProtocol();
			},
			function () {
				//if (self.options.force) { utilities.tryDelete(filename); }
				var segment = self._getPrivateKeySegmentName();
				return dfu.read(filename, segment, false);
			},
			function () {
				var pubPemFilename = utilities.filenameNoExt(filename) + '.pub.pem';
				if (self.options.force) {
					utilities.tryDelete(pubPemFilename);
				}
				var alg = self._getPrivateKeyAlgorithm();
				return utilities.deferredChildProcess('openssl ' + alg + ' -in ' + filename + ' -inform DER -pubout -out ' + pubPemFilename).catch(function (err) {
					console.error('Unable to generate public key from the key downloaded from the device. This usually means you had a corrupt key on the device. Error: ', err);
				});
			}
		]);

		ready.then(function () {
			console.log('Saved!');
		}, function (err) {
			console.error('Error saving key from device... ' + err);
		});

		return ready;
	},

	sendPublicKeyToServer: function (deviceid, filename) {
		if (!deviceid || filename === '--product_id') {
			console.log('Please provide a device id');
			return when.reject('Please provide a device id');
		}

		if (!filename || filename === '--product_id') {
			console.log("Please provide a filename for your device's public key ending in .pub.pem");
			return when.reject("Please provide a filename for your device's public key ending in .pub.pem");
		}

		this.checkArguments(arguments);

		return this._sendPublicKeyToServer(deviceid, filename, 'rsa');
	},

	_sendPublicKeyToServer: function(deviceid, filename, algorithm) {
		var self = this;
		if (!fs.existsSync(filename)) {
			filename = utilities.filenameNoExt(filename) + '.pub.pem';
			if (!fs.existsSync(filename)) {
				console.error("Couldn't find " + filename);
				return when.reject("Couldn't find " + filename);
			}
		}

		deviceid = deviceid.toLowerCase();

		var api = new ApiClient();
		if (!api.ready()) {
			return when.reject('Not logged in');
		}

		var pubKey = temp.path({ suffix: '.pub.pem' });
		var inform = path.extname(filename).toLowerCase() === '.der' ? 'DER' : 'PEM';

		return pipeline([
			function() {
				// try both private and public versions and both algorithms
				return utilities.deferredChildProcess('openssl ' + algorithm + ' -inform ' + inform + ' -in ' + filename + ' -pubout -outform PEM -out ' + pubKey)
					.catch(function(err) {
						return utilities.deferredChildProcess('openssl ' + algorithm + ' -pubin -inform ' + inform + ' -in ' + filename + ' -pubout -outform PEM -out ' + pubKey);
					})
					.catch(function(err) {
						// try other algorithm next
						algorithm = algorithm === 'rsa' ? 'ec' : 'rsa';
						return utilities.deferredChildProcess('openssl ' + algorithm + ' -inform ' + inform + ' -in ' + filename + ' -pubout -outform PEM -out ' + pubKey);
					})
					.catch(function(err) {
						return utilities.deferredChildProcess('openssl ' + algorithm + ' -pubin -inform ' + inform + ' -in ' + filename + ' -pubout -outform PEM -out ' + pubKey);
					});
			},
			function() {
				return whenNode.lift(fs.readFile)(pubKey);
			},
			function(keyBuf) {
				var apiAlg = algorithm === 'rsa' ? 'rsa' : 'ecc';
				return api.sendPublicKey(deviceid, keyBuf, apiAlg, self.options.productId);
			}
		]).catch(function(err) {
			console.log('Error sending public key to server: ' + err);
			return when.reject();
		}).finally(function() {
			fs.unlinkSync(pubKey);
		});
	},

	keyDoctor: function (deviceid) {
		var dfu = this.dfu;
		if (!deviceid || (deviceid === '')) {
			console.log('Please provide your device id');
			return -1;
		}
		deviceid = deviceid.toLowerCase();  // make lowercase so that it's case insensitive

		this.checkArguments(arguments);

		if (deviceid.length < 24) {
			console.log('***************************************************************');
			console.log('   Warning! - device id was shorter than 24 characters - did you use something other than an id?');
			console.log('   use particle identify to find your device id');
			console.log('***************************************************************');
		}

		var self = this;
		var alg, filename;
		var allDone = sequence([
			function() {
				return dfu.isDfuUtilInstalled();
			},
			function () {
				return dfu.findCompatibleDFU();
			},
			function () {
				return self.validateDeviceProtocol();
			},
			function() {
				alg = self._getPrivateKeyAlgorithm();
				filename = deviceid + '_' + alg + '_new';
				return self._makeNewKey(filename);
			},
			function() {
				return self.writeKeyToDevice(filename, true);
			},
			function() {
				return self._sendPublicKeyToServer(deviceid, filename, alg);
			}
		]);

		allDone.then(
			function () {
				console.log('Okay!  New keys in place, your device should restart.');
			},
			function (err) {
				console.log('Make sure your device is in DFU mode (blinking yellow), and that your computer is online.');
				console.error('Error - ' + err);
			});

		return allDone;
	},

	_createAddressBuffer: function(ipOrDomain) {
		var isIpAddress = /^[0-9.]*$/.test(ipOrDomain);

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
			return addressBuf.slice(0, 6);
		} else {
			addressBuf.write(ipOrDomain, 2);
		}

		return addressBuf;
	},

	writeServerPublicKey: function (filename, ipOrDomain, port) {
		var dfu = this.dfu;
		if (filename === '--protocol') {
			filename = null;
			ipOrDomain = null;
		}
		if (filename && !fs.existsSync(filename)) {
			console.log('Please specify a server key in DER format.');
			return -1;
		}
		if (port === '--protocol') {
			port = null;
		}
		if (ipOrDomain === '--protocol') {
			ipOrDomain = null;
			port = null;
		}
		var self = this;
		this.checkArguments(arguments);

		return pipeline([
			dfu.isDfuUtilInstalled,
			dfu.findCompatibleDFU,
			function() {
				return self.validateDeviceProtocol();
			},
			function() {
				return self._getDERPublicKey(filename);
			},
			function(derFile) {
				filename = derFile;
				return self._getIpAddress(ipOrDomain);
			},
			function(ip) {
				return self._formatPublicKey(filename, ip, port);
			},
			function(bufferFile) {
				var segment = self._getServerKeySegmentName();
				return dfu.write(bufferFile, segment, false);
			}
		]).then(
			function () {
				console.log('Okay!  New keys in place, your device will not restart.');
			},
			function (err) {
				console.log('Make sure your device is in DFU mode (blinking yellow), and is connected to your computer');
				console.error('Error - ' + err);
				return when.reject(err);
			});
	},

	readServerAddress: function() {
		var dfu = this.dfu;
		var self = this;
		this.checkArguments(arguments);

		var keyBuf, keyFilename, serverKeySeg, specs, transportFilename, transportFlag;

		return pipeline([
			dfu.isDfuUtilInstalled,
			dfu.findCompatibleDFU,
			function () {
				return self.validateDeviceProtocol();
			},
			function() {
				serverKeySeg = self._getServerKeySegment();
				specs = deviceSpecs[dfu.dfuId];
			},
			function() {
				keyFilename = temp.path({ suffix: '.der' });
				var segment = self._getServerKeySegmentName();
				//if (self.options.force) { utilities.tryDelete(filename); }
				return dfu.readBuffer(segment, false)
					.then(function(buf) {
						keyBuf = buf;
					});
			},
			function() {
				var offset = serverKeySeg.addressOffset || 384;
				var portOffset = serverKeySeg.portOffset || 450;
				var type = keyBuf[offset];
				var len = keyBuf[offset+1];
				var data = keyBuf.slice(offset + 2, offset + 2 + len);

				var protocol = self.options.protocol;
				var port = keyBuf[portOffset] << 8 | keyBuf[portOffset+1];
				if (port === 0xFFFF) {
					port = protocol === 'tcp' ? 5683 : 5684;
				}

				var host = protocol === 'tcp' ? 'device.spark.io' : 'udp.particle.io';
				if (len > 0) {
					if (type === 0) {
						host = Array.prototype.slice.call(data).join('.');
					} else if (type === 1) {
						host = data.toString('utf8');
					}
				}

				var result = {
					hostname: host,
					port: port,
					protocol: protocol,
					slashes: true
				};
				console.log();
				console.log(url.format(result));
				return result;
			}
		]).catch(function (err) {
			console.log('Make sure your device is in DFU mode (blinking yellow), and is connected to your computer');
			console.error('Error - ' + err);
			return when.reject(err);
		});
	},

	/**
	 * Determines the protocol to use. If a protocol is set in options, that is used.
	 * For single-protocol devices, the default protocol is used. For multi-protocol devices
	 * the device is queried to find the current protocol, and that is used
	 * @param specs The DFU device sepcs.
	 * @returns {Promise.<String>}  The
	 */
	validateDeviceProtocol: function(specs) {
		specs = specs || deviceSpecs[this.dfu.dfuId];
		var protocol = this.options.protocol ? when.resolve(this.options.protocol) : this.fetchDeviceProtocol(specs);
		var self = this;
		return protocol.then(function (protocol) {
			var supported = [ specs.defaultProtocol ];
			if (specs.alternativeProtocol) {
				supported.push(specs.alternativeProtocol);
			}
			if (supported.indexOf(protocol)<0) {
				throw Error('The device does not support the protocol ' + protocol + '. It has support for '+supported.join(', ') );
			}
			self.options.protocol = protocol;
			return protocol;
		});
	},

	_getServerKeySegmentName: function() {
		var dfu = this.dfu;
		if (!dfu.dfuId) {
			return;
		}

		var specs = deviceSpecs[dfu.dfuId];
		if (!specs) {
			return;
		}
		var protocol = this.options.protocol || specs.defaultProtocol || 'tcp';
		var key = protocol + 'ServerKey';
		return key;
	},

	/**
	 * Retrieves the protocol that is presently configured
	 * on the device.  When the device supports just one protocol, then
	 * that protocol is returned. For multi-protocol devices, the device is quried
	 * to determine the currently active protocol.
	 * Assumes that the dfu device has already been established.
	 * @param specs The DFU specs for the device
	 * @returns {Promise.<String>} The protocol configured on the device.
	 */
	fetchDeviceProtocol: function(specs) {
		if (specs.transport && specs.alternativeProtocol) {
			return this.dfu.readBuffer('transport', false)
				.then(function(buf) {
					return buf[0]===0xFF ? specs.defaultProtocol : specs.alternativeProtocol;
				});
		}
		return when.resolve(specs.defaultProtocol);
	},

	_getServerKeySegment: function() {
		var dfu = this.dfu;
		if (!dfu.dfuId) {
			return;
		}
		var specs = deviceSpecs[dfu.dfuId];
		var segmentName = this._getServerKeySegmentName();
		if (!specs || !segmentName) {
			return;
		}
		return specs[segmentName];
	},

	_getServerKeyAlgorithm: function() {
		var segment = this._getServerKeySegment();
		if (!segment) {
			return;
		}
		return segment.alg || 'rsa';
	},

	_getPrivateKeySegmentName: function() {
		var dfu = this.dfu;
		if (!dfu.dfuId) {
			return;
		}

		var specs = deviceSpecs[dfu.dfuId];
		if (!specs) {
			return;
		}
		var protocol = this.options.protocol || specs.defaultProtocol || 'tcp';
		var key = protocol + 'PrivateKey';
		return key;
	},

	_getPrivateKeySegment: function() {
		var dfu = this.dfu;
		if (!dfu.dfuId) {
			return;
		}
		var specs = deviceSpecs[dfu.dfuId];
		var segmentName = this._getPrivateKeySegmentName();
		if (!specs || !segmentName) {
			return;
		}
		return specs[segmentName];
	},

	_getPrivateKeyAlgorithm: function() {
		var segment = this._getPrivateKeySegment();
		return (segment && segment.alg) || 'rsa';
	},

	_getServerAddressOffset: function() {
		var segment = this._getServerKeySegment();
		if (!segment) {
			return;
		}
		return segment.addressOffset;
	},

	_getDERPublicKey: function(filename) {
		var alg = this._getServerKeyAlgorithm();
		if (!alg) {
			return when.reject('No device specs');
		}

		if (!filename) {
			filename = this.serverKeyFilename(alg);
		}

		if (utilities.getFilenameExt(filename).toLowerCase() !== '.der') {
			var derFile = utilities.filenameNoExt(filename) + '.der';

			if (!fs.existsSync(derFile)) {
				console.log('Creating DER format file');
				var derFilePromise = utilities.deferredChildProcess('openssl ' + alg + ' -in  ' + filename + ' -pubin -pubout -outform DER -out ' + derFile);
				return when(derFilePromise).then(function() {
					return derFile;
				}, function(err) {
					console.error('Error creating a DER formatted version of that key.  Make sure you specified the public key: ' + err);
					return when.reject(err);
				});
			} else {
				return when.resolve(derFile);
			}
		}
		return when.resolve(filename);
	},

	serverKeyFilename: function(alg) {
		return path.join(__dirname, '../assets/keys/' + alg + '.pub.der');
	},

	_formatPublicKey: function(filename, ipOrDomain, port) {
		var segment = this._getServerKeySegment();
		if (!segment) {
			return when.reject('No device specs');
		}

		var buf, fileBuf;
		if (ipOrDomain) {
			var alg = segment.alg || 'rsa';
			var file_with_address = util.format('%s-%s-%s.der', utilities.filenameNoExt(filename), utilities.replaceAll(ipOrDomain, '.', '_'), alg);
			if (!fs.existsSync(file_with_address)) {
				var addressBuf = this._createAddressBuffer(ipOrDomain);

				// To generate a file like this, just add a type-length-value (TLV) encoded IP or domain beginning 384 bytes into the file—on external flash the address begins at 0x1180.
				// Everything between the end of the key and the beginning of the address should be 0xFF.
				// The first byte representing "type" is 0x00 for 4-byte IP address or 0x01 for domain name—anything else is considered invalid and uses the fallback domain.
				// The second byte is 0x04 for an IP address or the length of the string for a domain name.
				// The remaining bytes are the IP or domain name. If the length of the domain name is odd, add a zero byte to get the file length to be even as usual.

				buf = new Buffer(segment.size);

				//copy in the key
				fileBuf = fs.readFileSync(filename);
				fileBuf.copy(buf, 0, 0, fileBuf.length);

				//fill the rest with "FF"
				buf.fill(255, fileBuf.length);


				var offset = segment.addressOffset || 384;
				addressBuf.copy(buf, offset, 0, addressBuf.length);

				if (port && segment.portOffset) {
					buf.writeUInt16BE(port, segment.portOffset);
				}

				//console.log("address chunk is now: " + addressBuf.toString('hex'));
				//console.log("Key chunk is now: " + buf.toString('hex'));

				fs.writeFileSync(file_with_address, buf);
			}
			return file_with_address;
		}

		var stats = fs.statSync(filename);
		if (stats.size < segment.size) {
			var fileWithSize = util.format('%s-padded.der', utilities.filenameNoExt(filename));
			if (!fs.existsSync(fileWithSize)) {
				buf = new Buffer(segment.size);

				fileBuf = fs.readFileSync(filename);
				fileBuf.copy(buf, 0, 0, fileBuf.length);

				buf.fill(255, fileBuf.length);

				fs.writeFileSync(fileWithSize, buf);
			}
			return fileWithSize;
		}
		return filename;
	},

	_getIpAddress: function(ipOrDomain) {
		if (ipOrDomain === 'mine') {
			var ips = utilities.getIPAddresses();
			if (ips.length === 1) {
				return ips[0];
			} else if (ips.length > 0) {
				// TODO show selector?
				return when.reject('Multiple valid ip addresses');
			} else {
				return when.reject('No IP addresses');
			}
		}
		return ipOrDomain;
	}
});

module.exports = KeyCommands;
