const fs = require('fs');
const url = require('url');
const path = require('path');
const VError = require('verror');
const temp = require('temp').track();
const utilities = require('../lib/utilities');
const ApiClient = require('../lib/api-client');
const deviceSpecs = require('../lib/deviceSpecs');
const ensureError = require('../lib/utilities').ensureError;
const dfu = require('../lib/dfu');

/**
 * Commands for managing encryption keys.
 * For devices that support a single protocol, the
 * key type defaults to that. For devices that support multiple
 * protocols, the `--protocol` flag can be used to
 * specify the protocol. When omitted, the current configured
 * protocol on the device is used.
 * @constructor
 */
module.exports = class KeysCommand {
	constructor() {
		this.dfu = dfu;
	}

	transportProtocol({ protocol }) {
		return protocol ? this.changeTransportProtocol(protocol) : this.showTransportProtocol();
	}

	showTransportProtocol() {
		return Promise.resolve().then(() => {
			return this.dfu.isDfuUtilInstalled();
		}).then(() => {
			//make sure our device is online and in dfu mode
			return this.dfu.findCompatibleDFU();
		}).then(() => {
			return this.validateDeviceProtocol();
		}).then(protocol => {
			console.log(`Device protocol is set to ${protocol}`);
		}).catch(err => {
			throw new VError(ensureError(err), 'Could not fetch device transport protocol');
		});
	}

	changeTransportProtocol(protocol) {
		if (protocol !== 'udp' && protocol !== 'tcp') {
			return new VError('Invalid protocol');
		}

		return Promise.resolve().then(() => {
			return this.dfu.isDfuUtilInstalled();
		}).then(() => {
			//make sure our device is online and in dfu mode
			return this.dfu.findCompatibleDFU();
		}).then(() => {
			let specs = deviceSpecs[this.dfu.dfuId];
			if (!specs.transport) {
				throw new VError('Protocol cannot be changed for this device');
			}

			let flagValue = specs.defaultProtocol === protocol ? new Buffer([255]) : new Buffer([0]);
			return this.dfu.writeBuffer(flagValue, 'transport', false);
		}).then(() => {
			console.log(`Protocol changed to ${protocol}`);
		}).catch(err => {
			throw new VError(ensureError(err), 'Could not change device transport protocol');
		});
	}

	makeKeyOpenSSL(filename, alg, { protocol }) {
		const { filenameNoExt, deferredChildProcess } = utilities;

		filename = filenameNoExt(filename);
		alg = alg || this._getPrivateKeyAlgorithm({ protocol });

		return Promise.resolve()
			.then(() => {
				if (alg === 'rsa') {
					return deferredChildProcess(`openssl genrsa -out "${filename}.pem" 1024`);
				} else if (alg === 'ec') {
					return deferredChildProcess(`openssl ecparam -name prime256v1 -genkey -out "${filename}.pem"`);
				}
			})
			.then(() => {
				return deferredChildProcess(`openssl ${alg} -in "${filename}.pem" -pubout -out "${filename}.pub.pem"`);
			})
			.then(() => {
				return deferredChildProcess(`openssl ${alg} -in "${filename}.pem" -outform DER -out "${filename}.der"`);
			});
	}

	keyAlgorithmForProtocol(protocol) {
		return protocol === 'udp' ? 'ec' : 'rsa';
	}

	makeNewKey(filename, { protocol }) {
		return this._makeNewKey({ filename: filename || 'device', protocol });
	}

	_makeNewKey({ filename, protocol }) {
		let alg;
		let showHelp = !protocol;
		return Promise.resolve().then(() => {
			return Promise.resolve().then(() => {
				return this.dfu.isDfuUtilInstalled();
			}).then(() => {
				return this.dfu.findCompatibleDFU(showHelp);
			}).catch((err) => {
				if (protocol) {
					alg = this.keyAlgorithmForProtocol(protocol);
					return;
				}
				throw err;
			});
		}).then(() => {
			return this.makeKeyOpenSSL(filename, alg, { protocol });
		}).then(() => {
			console.log('New Key Created!');
		}).catch(err => {
			throw new VError(ensureError(err), 'Error creating keys');
		});
	}

	writeKeyToDevice(filename) {
		return this._writeKeyToDevice({ filename });
	}

	_writeKeyToDevice({ filename, leave = false }) {
		let protocol;
		filename = utilities.filenameNoExt(filename) + '.der';
		if (!fs.existsSync(filename)) {
			throw new VError("I couldn't find the file: " + filename);
		}

		//TODO: give the user a warning before doing this, since it'll bump their device offline.

		return Promise.resolve().then(() => {
			return this.dfu.isDfuUtilInstalled();
		}).then(() => {
			//make sure our device is online and in DFU mode
			return this.dfu.findCompatibleDFU();
		}).then(() => {
			return this.validateDeviceProtocol();
		}).then(_protocol => {
			protocol = _protocol;
			//backup their existing key so they don't lock themselves out.
			let alg = this._getPrivateKeyAlgorithm({ protocol });
			let prefilename = path.join(
				path.dirname(filename),
				'backup_' + alg + '_' + path.basename(filename)
			);
			return this._saveKeyFromDevice({ filename: prefilename, force: true });
		}).then(() => {
			let segment = this._getPrivateKeySegmentName({ protocol });
			return this.dfu.write(filename, segment, leave);
		}).then(() => {
			console.log('Saved!');
		}).catch(err => {
			throw new VError(ensureError(err), 'Error writing key to device.');
		});
	}

	saveKeyFromDevice(filename, { force }) {
		filename = utilities.filenameNoExt(filename) + '.der';
		return this._saveKeyFromDevice({ filename, force });
	}

	_saveKeyFromDevice({ filename, force }) {
		const { tryDelete, filenameNoExt, deferredChildProcess } = utilities;
		let protocol;

		if (!force && fs.existsSync(filename)) {
			throw new VError('This file already exists, please specify a different file, or use the --force flag.');
		} else if (fs.existsSync(filename)) {
			tryDelete(filename);
		}

		//find this.dfu devices, make sure a device is connected
		//pull the key down and save it there

		return Promise.resolve()
			.then(() => {
				return this.dfu.isDfuUtilInstalled();
			})
			.then(() => {
				return this.dfu.findCompatibleDFU();
			})
			.then(() => {
				return this.validateDeviceProtocol();
			})
			.then(_protocol => {
				protocol = _protocol;
				let segment = this._getPrivateKeySegmentName({ protocol });
				return this.dfu.read(filename, segment, false);
			})
			.then(() => {
				let pubPemFilename = filenameNoExt(filename) + '.pub.pem';

				if (force) {
					tryDelete(pubPemFilename);
				}

				let alg = this._getPrivateKeyAlgorithm({ protocol });
				return deferredChildProcess(`openssl ${alg} -in "${filename}" -inform DER -pubout -out ${pubPemFilename}`)
					.catch((err) => {
						throw new VError(
							err,
							'Unable to generate public key from the key downloaded from the device. This usually means you had a corrupt key on the device.'
						);
					});
			})
			.then(() => {
				console.log('Saved!');
			})
			.catch(err => {
				return new VError(ensureError(err), 'Error saving key from device');
			});
	}

	sendPublicKeyToServer(deviceId, filename, { product_id: productId }) {
		return this._sendPublicKeyToServer({ deviceId, filename, productId, algorithm: 'rsa' });
	}

	_sendPublicKeyToServer({ deviceId, filename, productId, algorithm }) {
		const { filenameNoExt, deferredChildProcess, readFile } = utilities;

		if (!fs.existsSync(filename)) {
			filename = filenameNoExt(filename) + '.pub.pem';
			if (!fs.existsSync(filename)) {
				throw new VError("Couldn't find " + filename);
			}
		}

		deviceId = deviceId.toLowerCase();

		let api = new ApiClient();
		api.ensureToken();

		let pubKey = temp.path({ suffix: '.pub.pem' });
		let inform = path.extname(filename).toLowerCase() === '.der' ? 'DER' : 'PEM';
		const cleanup = () => fs.unlinkSync(pubKey);

		return Promise.resolve()
			.then(() => {
				// try both private and public versions and both algorithms
				return deferredChildProcess(`openssl ${algorithm} -inform ${inform} -in "${filename}" -pubout -outform PEM -out "${pubKey}"`)
					.catch(() => {
						return deferredChildProcess(`openssl ${algorithm} -pubin -inform ${inform} -in "${filename}" -pubout -outform PEM -out "${pubKey}"`);
					})
					.catch(() => {
						// try other algorithm next
						algorithm = algorithm === 'rsa' ? 'ec' : 'rsa';
						return deferredChildProcess(`openssl ${algorithm} -inform ${inform} -in "${filename}" -pubout -outform PEM -out "${pubKey}"`);
					})
					.catch(() => {
						return deferredChildProcess(`openssl ${algorithm} -pubin -inform ${inform} -in "${filename}" -pubout -outform PEM -out "${pubKey}"`);
					});
			})
			.then(() => {
				return readFile(pubKey);
			})
			.then(keyBuf => {
				let apiAlg = algorithm === 'rsa' ? 'rsa' : 'ecc';
				return api.sendPublicKey(deviceId, keyBuf, apiAlg, productId);
			})
			.catch(err => {
				throw new VError(ensureError(err), 'Error sending public key to server');
			})
			.then(cleanup, err => {
				cleanup();
				throw err;
			});
	}

	keyDoctor(deviceId, { protocol } = {}) {
		deviceId = deviceId.toLowerCase(); // make lowercase so that it's case insensitive

		if (deviceId.length < 24) {
			console.log('***************************************************************');
			console.log('   Warning! - device id was shorter than 24 characters - did you use something other than an id?');
			console.log('   use particle identify to find your device id');
			console.log('***************************************************************');
		}

		let algorithm, filename;
		return Promise.resolve().then(() => {
			return this.dfu.isDfuUtilInstalled();
		}).then(() => {
			return this.dfu.findCompatibleDFU();
		}).then(() => {
			return this.validateDeviceProtocol({ protocol });
		}).then(_protocol => {
			protocol = _protocol;
			algorithm = this._getPrivateKeyAlgorithm({ protocol });
			filename = deviceId + '_' + algorithm + '_new';
			return this._makeNewKey({ filename });
		}).then(() => {
			return this._writeKeyToDevice({ filename, leave: true });
		}).then(() => {
			return this._sendPublicKeyToServer({ deviceId, filename, algorithm });
		}).then(() => {
			console.log('Okay!  New keys in place, your device should restart.');
		}).catch(err => {
			throw new VError(ensureError(err), 'Make sure your device is in DFU mode (blinking yellow), and that your computer is online.');
		});
	}

	_createAddressBuffer(ipOrDomain) {
		const isIpAddress = /^[0-9.]*$/.test(ipOrDomain);

		// create a version of this key that points to a particular server or domain
		const addressBuf = new Buffer(ipOrDomain.length + 2);
		addressBuf[0] = (isIpAddress) ? 0 : 1;
		addressBuf[1] = (isIpAddress) ? 4 : ipOrDomain.length;

		if (isIpAddress) {
			const parts = ipOrDomain.split('.').map((obj) => {
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

	writeServerPublicKey({ filename, outputFilename, host, port, protocol, deviceType } = {}) {
		if (filename && !fs.existsSync(filename)) {
			// TODO UsageError
			throw new VError('Please specify a server key in DER format.');
		}

		let skipDFU = false;
		if (deviceType) {
			skipDFU = true;
			this.dfu.dfuId = Object.keys(deviceSpecs).filter(key => deviceSpecs[key].productName.toLowerCase() === deviceType.toLowerCase())[0];
		}

		return Promise.resolve().then(() => {
			if (!skipDFU) {
				return this.dfu.isDfuUtilInstalled()
				.then(() => {
					return this.dfu.findCompatibleDFU();
				}).then(() => {
					return this.validateDeviceProtocol({ protocol });
				})
			} else {
				return protocol;
			}
		}).then(_protocol => {
			protocol = _protocol;
			return this._getDERPublicKey(filename, { protocol });
		}).then(derFile => {
			return this._formatPublicKey(derFile, host, port, { protocol, outputFilename });
		}).then(bufferFile => {
			let segment = this._getServerKeySegmentName({ protocol });
			if (!skipDFU) {
				return this.dfu.write(bufferFile, segment, false);
			}
		}).then(() => {
			if (!skipDFU) {
				console.log('Okay!  New keys in place, your device will not restart.');
			} else {
				console.log('Okay!  Formated server key file generated for this type of device.');
			}
		}).catch(err => {
			throw new VError(ensureError(err), 'Make sure your device is in DFU mode (blinking yellow), and is connected to your computer.');
		});
	}

	readServerAddress({ protocol }) {
		let keyBuf, serverKeySeg;

		return Promise.resolve().then(() => {
			return this.dfu.isDfuUtilInstalled();
		}).then(() => {
			return this.dfu.findCompatibleDFU();
		}).then(() => {
			return this.validateDeviceProtocol({ protocol });
		}).then(_protocol => {
			protocol = _protocol;
			serverKeySeg = this._getServerKeySegment({ protocol });
		}).then(() => {
			let segment = this._getServerKeySegmentName({ protocol });
			return this.dfu.readBuffer(segment, false)
				.then((buf) => {
					keyBuf = buf;
				});
		}).then(() => {
			let offset = serverKeySeg.addressOffset || 384;
			let portOffset = serverKeySeg.portOffset || 450;
			let type = keyBuf[offset];
			let len = keyBuf[offset+1];
			let data = keyBuf.slice(offset + 2, offset + 2 + len);

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
		}).catch(err => {
			throw new VError(ensureError(err), 'Make sure your device is in DFU mode (blinking yellow), and is connected to your computer.');
		});
	}

	/**
	 * Determines the protocol to use. If a protocol is set in options, that is used.
	 * For single-protocol devices, the default protocol is used. For multi-protocol devices
	 * the device is queried to find the current protocol, and that is used
	 * @param specs The this.dfu device sepcs.
	 * @returns {Promise.<String>}  The
	 */
	validateDeviceProtocol({ specs, protocol } = {}) {
		specs = specs || deviceSpecs[this.dfu.dfuId];
		let protocolPromise = protocol ? Promise.resolve(protocol) : this.fetchDeviceProtocol(specs);
		return protocolPromise.then(detectedProtocol => {
			let supported = [specs.defaultProtocol];
			if (specs.alternativeProtocol) {
				supported.push(specs.alternativeProtocol);
			}
			if (supported.indexOf(detectedProtocol)<0) {
				throw new VError(`The device does not support the protocol ${detectedProtocol}. It has support for ${supported.join(', ')}`);
			}
			return detectedProtocol;
		});
	}

	_getServerKeySegmentName({ protocol }) {
		if (!this.dfu.dfuId) {
			return;
		}

		let specs = deviceSpecs[this.dfu.dfuId];
		if (!specs) {
			return;
		}
		protocol = protocol || specs.defaultProtocol || 'tcp';
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
			return this.dfu.readBuffer('transport', false).then(buf => {
				return buf[0]===0xFF ? specs.defaultProtocol : specs.alternativeProtocol;
			});
		}
		return Promise.resolve(specs.defaultProtocol);
	}

	_getServerKeySegment({ protocol }) {
		if (!this.dfu.dfuId) {
			return;
		}
		let specs = deviceSpecs[this.dfu.dfuId];
		let segmentName = this._getServerKeySegmentName({ protocol });
		if (!specs || !segmentName) {
			return;
		}
		return specs[segmentName];
	}

	_getServerKeyAlgorithm({ protocol }) {
		let segment = this._getServerKeySegment({ protocol });
		if (!segment) {
			return;
		}
		return segment.alg || 'rsa';
	}

	_getServerKeyVariant({ protocol }) {
		let segment = this._getServerKeySegment({ protocol });
		if (!segment) {
			return;
		}
		return segment.variant;
	}

	_getPrivateKeySegmentName({ protocol }) {
		if (!this.dfu.dfuId) {
			return;
		}

		let specs = deviceSpecs[this.dfu.dfuId];
		if (!specs) {
			return;
		}
		protocol = protocol || specs.defaultProtocol || 'tcp';
		return protocol + 'PrivateKey';
	}

	_getPrivateKeySegment({ protocol }) {
		if (!this.dfu.dfuId) {
			return;
		}
		let specs = deviceSpecs[this.dfu.dfuId];
		let segmentName = this._getPrivateKeySegmentName({ protocol });
		if (!specs || !segmentName) {
			return;
		}
		return specs[segmentName];
	}

	_getPrivateKeyAlgorithm({ protocol }) {
		let segment = this._getPrivateKeySegment({ protocol });
		return (segment && segment.alg) || 'rsa';
	}

	_getDERPublicKey(filename, { protocol }) {
		const { getFilenameExt, filenameNoExt, deferredChildProcess } = utilities;
		let alg = this._getServerKeyAlgorithm({ protocol });

		if (!alg) {
			throw new VError('No device specs');
		}

		let variant = this._getServerKeyVariant({ protocol });

		if (!filename) {
			filename = this.serverKeyFilename({ alg, variant });
		}

		if (getFilenameExt(filename).toLowerCase() !== '.der') {
			let derFile = filenameNoExt(filename) + '.der';

			if (!fs.existsSync(derFile)) {
				console.log('Creating DER format file');
				let derFilePromise = deferredChildProcess(`openssl ${alg} -in "${filename}" -pubin -pubout -outform DER -out "${derFile}"`);
				return derFilePromise
					.then(() => {
						return derFile;
					})
					.catch(err => {
						throw new VError(ensureError(err), 'Error creating a DER formatted version of that key.  Make sure you specified the public key');
					});
			} else {
				return Promise.resolve(derFile);
			}
		}
		return Promise.resolve(filename);
	}

	serverKeyFilename({ alg, variant }) {
		const basename = variant ? `${alg}-${variant}` : alg;
		return path.join(__dirname, `../../assets/keys/${basename}.pub.der`);
	}

	_formatPublicKey(filename, ipOrDomain, port, { protocol, outputFilename }) {
		let segment = this._getServerKeySegment({ protocol });
		if (!segment) {
			throw new VError('No device specs');
		}

		let buf, fileBuf;
		if (ipOrDomain) {
			let alg = segment.alg || 'rsa';
			let fileWithAddress = `${utilities.filenameNoExt(filename)}-${utilities.replaceAll(ipOrDomain, '.', '_')}-${alg}.der`;
			if (outputFilename) {
				fileWithAddress = outputFilename;
			}
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

			return fileWithAddress;
		}

		let stats = fs.statSync(filename);
		if (stats.size < segment.size) {
			let fileWithSize = `${utilities.filenameNoExt(filename)}-padded.der`;
			if (outputFilename) {
				fileWithSize = outputFilename;
			}
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
};

