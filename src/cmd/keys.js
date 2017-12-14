const url = require('url');
const when = require('when');
const whenNode = require('when/node');
const sequence = require('when/sequence');
const pipeline = require('when/pipeline');
const temp = require('temp').track();
const utilities = require('../lib/utilities.js');
const ApiClient = require('../lib/ApiClient.js');
const fs = require('fs');
const path = require('path');
const dfu = require('../lib/dfu.js');
const deviceSpecs = require('../lib/deviceSpecs');

/**
 * Commands for managing encryption keys.
 * For devices that support a single protocol, the
 * key type defaults to that. For devices that support multiple
 * protcools, the `--protocol` flag can be used to
 * specify the protocol. When omitted, the current configured
 * protocol on the device is used.
 * @constructor
 */
class KeysCommand {
	constructor(args) {
		this.dfu = dfu;
		this.options = args;
	}

	transportProtocol() {
		const protocol = this.options.protocol;
		return protocol ? this.changeTransportProtocol(protocol) : this.showTransportProtocol();
	}

	showTransportProtocol() {
		return sequence([
			() => {
				return this.dfu.isDfuUtilInstalled();
			},
			() => {
				//make sure our device is online and in dfu mode
				return this.dfu.findCompatibleDFU();
			},
			() => {
				return this.validateDeviceProtocol();
			}
		]).then((protocol) => {
			console.log(`Device protocol is set to ${this.options.protocol}`);
		}).catch((err) => {
			return when.reject(`Error ${err.message || err}`);
		});
	}

	changeTransportProtocol(protocol) {
		if (protocol !== 'udp' && protocol !== 'tcp') {
			return when.reject('Invalid protocol');
		}

		return sequence([
			() => {
				return this.dfu.isDfuUtilInstalled();
			},
			() => {
				//make sure our device is online and in dfu mode
				return this.dfu.findCompatibleDFU();
			},
			() => {
				let specs = deviceSpecs[this.dfu.dfuId];
				if (!specs.transport) {
					return when.reject('Protocol cannot be changed for this device');
				}

				let flagValue = specs.defaultProtocol === protocol ? new Buffer([255]) : new Buffer([0]);
				return this.dfu.writeBuffer(flagValue, 'transport', false);
			}
		]).then(() => {
			console.log(`Protocol changed to ${protocol}`);
		}).catch((err) => {
			return when.reject(`Error ${err.message || err}`);
		});
	}

	makeKeyOpenSSL(filename, alg) {
		filename = utilities.filenameNoExt(filename);

		// FIXME: unused
		if (this.options.force) {
			utilities.tryDelete(filename + '.pem');
			utilities.tryDelete(filename + '.pub.pem');
			utilities.tryDelete(filename + '.der');
		}

		alg = alg || this._getPrivateKeyAlgorithm();

		return sequence([
			() => {
				if (alg === 'rsa') {
					return utilities.deferredChildProcess(`openssl genrsa -out ${filename}.pem 1024`);
				} else if (alg === 'ec') {
					return utilities.deferredChildProcess(`openssl ecparam -name prime256v1 -genkey -out ${filename}.pem`);
				}
			},
			() => {
				return utilities.deferredChildProcess(`openssl ${alg} -in ${filename}.pem -pubout -out ${filename}.pub.pem`);
			},
			() => {
				return utilities.deferredChildProcess(`openssl ${alg} -in ${filename}.pem -outform DER -out ${filename}.der`);
			}
		]);
	}

	keyAlgorithmForProtocol(protocol) {
		return protocol === 'udp' ? 'ec' : 'rsa';
	}

	makeNewKey() {
		const filename = this.options.params.filename || 'device';
		return this._makeNewKey({ filename });
	}

	_makeNewKey({ filename }) {
		let alg;
		let showHelp = !this.options.protocol;
		return sequence([
			() => {
				return sequence([
					() => {
						return this.dfu.isDfuUtilInstalled();
					},
					() => {
						return this.dfu.findCompatibleDFU(showHelp);
					}
				]).catch((err) => {
					if (this.options.protocol) {
						alg = this.keyAlgorithmForProtocol(this.options.protocol);
						return;
					}
					return when.reject(err);
				});
			},
			() => {
				return this.makeKeyOpenSSL(filename, alg);
			}
		]).then(() => {
			console.log('New Key Created!');
		}, (err) => {
			return when.reject(`Error creating keys... ${err.message || err}`);
		});
	}

	writeKeyToDevice() {
		const filename = this.options.params.filename;
		return this._writeKeyToDevice({ filename });
	}

	_writeKeyToDevice({ filename, leave = false }) {
		filename = utilities.filenameNoExt(filename) + '.der';
		if (!fs.existsSync(filename)) {
			return when.reject("I couldn't find the file: " + filename);
		}

		//TODO: give the user a warning before doing this, since it'll bump their device offline.

		return sequence([
			() => {
				return this.dfu.isDfuUtilInstalled();
			},
			() => {
				//make sure our device is online and in DFU mode
				return this.dfu.findCompatibleDFU();
			},
			() => {
				return this.validateDeviceProtocol();
			},
			//backup their existing key so they don't lock themselves out.
			() => {
				let alg = this._getPrivateKeyAlgorithm();
				let prefilename = path.join(
						path.dirname(filename),
					'backup_' + alg + '_' + path.basename(filename)
				);
				return this._saveKeyFromDevice({ filename: prefilename, force: true });
			},
			() => {
				let segment = this._getPrivateKeySegmentName();
				return this.dfu.write(filename, segment, leave);
			}
		]).then(() => {
			console.log('Saved!');
		}, (err) => {
			return when.reject(`Error writing key to device... ${err.message || err}`);
		});
	}

	saveKeyFromDevice() {
		const filename = utilities.filenameNoExt(this.options.params.filename) + '.der';
		const force = this.options.force;
		return this._saveKeyFromDevice({ filename, force });
	}

	_saveKeyFromDevice({ filename, force }) {
		if (!force && fs.existsSync(filename)) {
			const msg = 'This file already exists, please specify a different file, or use the --force flag.';
			return when.reject(msg);
		} else if (fs.existsSync(filename)) {
			utilities.tryDelete(filename);
		}

		//find this.dfu devices, make sure a device is connected
		//pull the key down and save it there

		return sequence([
			() => {
				return this.dfu.isDfuUtilInstalled();
			},
			() => {
				return this.dfu.findCompatibleDFU();
			},
			() => {
				return this.validateDeviceProtocol();
			},
			() => {
				let segment = this._getPrivateKeySegmentName();
				return this.dfu.read(filename, segment, false);
			},
			() => {
				let pubPemFilename = utilities.filenameNoExt(filename) + '.pub.pem';
				if (this.options.force) {
					utilities.tryDelete(pubPemFilename);
				}
				let alg = this._getPrivateKeyAlgorithm();
				return utilities.deferredChildProcess(`openssl ${alg} -in ${filename} -inform DER -pubout -out ${pubPemFilename}`).catch((err) => {
					return when.reject(`Unable to generate public key from the key downloaded from the device. This usually means you had a corrupt key on the device. Error: ${err.message || err}`);
				});
			}
		]).then(() => {
			console.log('Saved!');
		}, (err) => {
			return when.reject(`Error saving key from device... ${err.message || err}`);
		});
	}

	sendPublicKeyToServer() {
		const deviceId = this.options.params.device;
		const filename = this.options.params.filename;
		const productId = this.options.product_id;

		return this._sendPublicKeyToServer({ deviceId, filename, productId, algorithm: 'rsa' });
	}

	_sendPublicKeyToServer({ deviceId, filename, productId, algorithm }) {
		if (!fs.existsSync(filename)) {
			filename = utilities.filenameNoExt(filename) + '.pub.pem';
			if (!fs.existsSync(filename)) {
				return when.reject("Couldn't find " + filename);
			}
		}

		deviceId = deviceId.toLowerCase();

		let api = new ApiClient();
		if (!api.ready()) {
			return when.reject('Not logged in');
		}

		let pubKey = temp.path({ suffix: '.pub.pem' });
		let inform = path.extname(filename).toLowerCase() === '.der' ? 'DER' : 'PEM';

		return pipeline([
			() => {
				// try both private and public versions and both algorithms
				return utilities.deferredChildProcess('openssl ' + algorithm + ' -inform ' + inform + ' -in ' + filename + ' -pubout -outform PEM -out ' + pubKey)
					.catch(() => {
						return utilities.deferredChildProcess('openssl ' + algorithm + ' -pubin -inform ' + inform + ' -in ' + filename + ' -pubout -outform PEM -out ' + pubKey);
					})
					.catch(() => {
						// try other algorithm next
						algorithm = algorithm === 'rsa' ? 'ec' : 'rsa';
						return utilities.deferredChildProcess('openssl ' + algorithm + ' -inform ' + inform + ' -in ' + filename + ' -pubout -outform PEM -out ' + pubKey);
					})
					.catch(() => {
						return utilities.deferredChildProcess('openssl ' + algorithm + ' -pubin -inform ' + inform + ' -in ' + filename + ' -pubout -outform PEM -out ' + pubKey);
					});
			},
			() => {
				return whenNode.lift(fs.readFile)(pubKey);
			},
			(keyBuf) => {
				let apiAlg = algorithm === 'rsa' ? 'rsa' : 'ecc';
				return api.sendPublicKey(deviceId, keyBuf, apiAlg, productId);
			}
		]).catch((err) => {
			return when.reject(`Error sending public key to server: ${err.message || err}`);
		}).finally(() => {
			fs.unlinkSync(pubKey);
		});
	}

	keyDoctor() {
		const deviceId = this.options.params.device;
		return this._keyDoctor({ deviceId });
	}

	_keyDoctor({ deviceId }) {
		deviceId = deviceId.toLowerCase();  // make lowercase so that it's case insensitive

		if (deviceId.length < 24) {
			console.log('***************************************************************');
			console.log('   Warning! - device id was shorter than 24 characters - did you use something other than an id?');
			console.log('   use particle identify to find your device id');
			console.log('***************************************************************');
		}

		let algorithm, filename;
		return sequence([
			() => {
				return this.dfu.isDfuUtilInstalled();
			},
			() => {
				return this.dfu.findCompatibleDFU();
			},
			() => {
				return this.validateDeviceProtocol();
			},
			() => {
				algorithm = this._getPrivateKeyAlgorithm();
				filename = deviceId + '_' + algorithm + '_new';
				return this._makeNewKey({ filename });
			},
			() => {
				return this._writeKeyToDevice({ filename, leave: true });
			},
			() => {
				return this._sendPublicKeyToServer({ deviceId, filename, algorithm });
			}
		]).then(
			() => {
				console.log('Okay!  New keys in place, your device should restart.');
			},
			(err) => {
				return when.reject(
					'Make sure your device is in DFU mode (blinking yellow), and that your computer is online.\n' +
					`Error: ${err.message || err}`
				);
			});
	}

	_createAddressBuffer(ipOrDomain) {
		let isIpAddress = /^[0-9.]*$/.test(ipOrDomain);

		// create a version of this key that points to a particular server or domain
		let addressBuf = new Buffer(ipOrDomain.length + 2);
		addressBuf[0] = (isIpAddress) ? 0 : 1;
		addressBuf[1] = (isIpAddress) ? 4 : ipOrDomain.length;

		if (isIpAddress) {
			let parts = ipOrDomain.split('.').map((obj) => {
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
	}

	writeServerPublicKey() {
		const filename = this.options.params.filename;
		const hostname = this.options.host;
		const port = this.options.port;
		const protocol = this.options.protocol;

		return this._writeServerPublicKey({ filename, hostname, port, protocol });
	}

	_writeServerPublicKey({ filename, hostname, port, protocol }) {
		if (filename && !fs.existsSync(filename)) {
			return when.reject('Please specify a server key in DER format.');
		}

		return pipeline([
			() => {
				return this.dfu.isDfuUtilInstalled();
			},
			() => {
				return this.dfu.findCompatibleDFU();
			},
			() => {
				return this.validateDeviceProtocol();
			},
			() => {
				return this._getDERPublicKey(filename);
			},
			(derFile) => {
				filename = derFile;
				return this._getIpAddress(hostname);
			},
			(ip) => {
				return this._formatPublicKey(filename, ip, port);
			},
			(bufferFile) => {
				let segment = this._getServerKeySegmentName();
				return this.dfu.write(bufferFile, segment, false);
			}
		]).then(
			() => {
				console.log('Okay!  New keys in place, your device will not restart.');
			},
			(err) => {
				return when.reject(
					'Make sure your device is in DFU mode (blinking yellow), and is connected to your computer.\n' +
					`Error: ${err.message || err}`
				);
			});
	}

	readServerAddress() {
		let keyBuf, serverKeySeg;

		return pipeline([
			() => {
				return this.dfu.isDfuUtilInstalled();
			},
			() => {
				return this.dfu.findCompatibleDFU();
			},
			() => {
				return this.validateDeviceProtocol();
			},
			() => {
				serverKeySeg = this._getServerKeySegment();
			},
			() => {
				let segment = this._getServerKeySegmentName();
				return this.dfu.readBuffer(segment, false)
					.then((buf) => {
						keyBuf = buf;
					});
			},
			() => {
				let offset = serverKeySeg.addressOffset || 384;
				let portOffset = serverKeySeg.portOffset || 450;
				let type = keyBuf[offset];
				let len = keyBuf[offset+1];
				let data = keyBuf.slice(offset + 2, offset + 2 + len);

				let protocol = this.options.protocol;
				let port = keyBuf[portOffset] << 8 | keyBuf[portOffset+1];
				if (port === 0xFFFF) {
					port = protocol === 'tcp' ? 5683 : 5684;
				}

				let host = protocol === 'tcp' ? 'device.spark.io' : 'udp.particle.io';
				if (len > 0) {
					if (type === 0) {
						host = Array.prototype.slice.call(data).join('.');
					} else if (type === 1) {
						host = data.toString('utf8');
					}
				}

				let result = {
					hostname: host,
					port: port,
					protocol: protocol,
					slashes: true
				};
				console.log();
				console.log(url.format(result));
				return result;
			}
		]).catch((err) => {
			return when.reject(
				'Make sure your device is in DFU mode (blinking yellow), and is connected to your computer.\n' +
				`Error: ${err.message || err}`
			);
		});
	}

	/**
	 * Determines the protocol to use. If a protocol is set in options, that is used.
	 * For single-protocol devices, the default protocol is used. For multi-protocol devices
	 * the device is queried to find the current protocol, and that is used
	 * @param specs The this.dfu device sepcs.
	 * @returns {Promise.<String>}  The
	 */
	validateDeviceProtocol(specs) {
		specs = specs || deviceSpecs[this.dfu.dfuId];
		let protocol = this.options.protocol ? when.resolve(this.options.protocol) : this.fetchDeviceProtocol(specs);
		return protocol.then((protocol) => {
			let supported = [specs.defaultProtocol];
			if (specs.alternativeProtocol) {
				supported.push(specs.alternativeProtocol);
			}
			if (supported.indexOf(protocol)<0) {
				throw Error('The device does not support the protocol ' + protocol + '. It has support for '+supported.join(', ') );
			}
			this.options.protocol = protocol;
			return protocol;
		});
	}

	_getServerKeySegmentName() {
		if (!this.dfu.dfuId) {
			return;
		}

		let specs = deviceSpecs[this.dfu.dfuId];
		if (!specs) {
			return;
		}
		let protocol = this.options.protocol || specs.defaultProtocol || 'tcp';
		return protocol + 'ServerKey';
	}

	/**
	 * Retrieves the protocol that is presently configured
	 * on the device.  When the device supports just one protocol, then
	 * that protocol is returned. For multi-protocol devices, the device is quried
	 * to determine the currently active protocol.
	 * Assumes that the this.dfu device has already been established.
	 * @param specs The this.dfu specs for the device
	 * @returns {Promise.<String>} The protocol configured on the device.
	 */
	fetchDeviceProtocol(specs) {
		if (specs.transport && specs.alternativeProtocol) {
			return this.dfu.readBuffer('transport', false)
				.then((buf) => {
					return buf[0]===0xFF ? specs.defaultProtocol : specs.alternativeProtocol;
				});
		}
		return when.resolve(specs.defaultProtocol);
	}

	_getServerKeySegment() {
		if (!this.dfu.dfuId) {
			return;
		}
		let specs = deviceSpecs[this.dfu.dfuId];
		let segmentName = this._getServerKeySegmentName();
		if (!specs || !segmentName) {
			return;
		}
		return specs[segmentName];
	}

	_getServerKeyAlgorithm() {
		let segment = this._getServerKeySegment();
		if (!segment) {
			return;
		}
		return segment.alg || 'rsa';
	}

	_getPrivateKeySegmentName() {
		if (!this.dfu.dfuId) {
			return;
		}

		let specs = deviceSpecs[this.dfu.dfuId];
		if (!specs) {
			return;
		}
		let protocol = this.options.protocol || specs.defaultProtocol || 'tcp';
		let key = protocol + 'PrivateKey';
		return key;
	}

	_getPrivateKeySegment() {
		if (!this.dfu.dfuId) {
			return;
		}
		let specs = deviceSpecs[this.dfu.dfuId];
		let segmentName = this._getPrivateKeySegmentName();
		if (!specs || !segmentName) {
			return;
		}
		return specs[segmentName];
	}

	_getPrivateKeyAlgorithm() {
		let segment = this._getPrivateKeySegment();
		return (segment && segment.alg) || 'rsa';
	}

	_getServerAddressOffset() {
		let segment = this._getServerKeySegment();
		if (!segment) {
			return;
		}
		return segment.addressOffset;
	}

	_getDERPublicKey(filename) {
		let alg = this._getServerKeyAlgorithm();
		if (!alg) {
			return when.reject('No device specs');
		}

		if (!filename) {
			filename = this.serverKeyFilename(alg);
		}

		if (utilities.getFilenameExt(filename).toLowerCase() !== '.der') {
			let derFile = utilities.filenameNoExt(filename) + '.der';

			if (!fs.existsSync(derFile)) {
				console.log('Creating DER format file');
				let derFilePromise = utilities.deferredChildProcess('openssl ' + alg + ' -in  ' + filename + ' -pubin -pubout -outform DER -out ' + derFile);
				return when(derFilePromise).then(() => {
					return derFile;
				}, (err) => {
					return when.reject(`Error creating a DER formatted version of that key.  Make sure you specified the public key: ${err.message || err}`);
				});
			} else {
				return when.resolve(derFile);
			}
		}
		return when.resolve(filename);
	}

	serverKeyFilename(alg) {
		return path.join(__dirname, '../../assets/keys/' + alg + '.pub.der');
	}

	_formatPublicKey(filename, ipOrDomain, port) {
		let segment = this._getServerKeySegment();
		if (!segment) {
			return when.reject('No device specs');
		}

		let buf, fileBuf;
		if (ipOrDomain) {
			let alg = segment.alg || 'rsa';
			let fileWithAddress = `${utilities.filenameNoExt(filename)}-${utilities.replaceAll(ipOrDomain, '.', '_')}-${alg}.der`;
			if (!fs.existsSync(fileWithAddress)) {
				let addressBuf = this._createAddressBuffer(ipOrDomain);

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


				let offset = segment.addressOffset || 384;
				addressBuf.copy(buf, offset, 0, addressBuf.length);

				if (port && segment.portOffset) {
					buf.writeUInt16BE(port, segment.portOffset);
				}

				//console.log("address chunk is now: " + addressBuf.toString('hex'));
				//console.log("Key chunk is now: " + buf.toString('hex'));

				fs.writeFileSync(fileWithAddress, buf);
			}
			return fileWithAddress;
		}

		let stats = fs.statSync(filename);
		if (stats.size < segment.size) {
			let fileWithSize = `${utilities.filenameNoExt(filename)}-padded.der`;
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
	}

	_getIpAddress(ipOrDomain) {
		if (ipOrDomain === 'mine') {
			let ips = utilities.getIPAddresses();
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
}

module.exports = KeysCommand;
