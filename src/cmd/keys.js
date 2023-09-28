const fs = require('fs');
const url = require('url');
const path = require('path');
const settings = require('../../settings');
const usbUtils = require('./usb-util');
const VError = require('verror');
const temp = require('temp').track();
const utilities = require('../lib/utilities');
const ApiClient = require('../lib/api-client');
const deviceSpecs = require('../lib/device-specs');
const ensureError = require('../lib/utilities').ensureError;
const { errors: { usageError } } = require('../app/command-processor');
const UI = require('../lib/ui');
const ParticleApi = require('./api');

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
	constructor(){
		this.dfuId = null;
		this.auth = settings.access_token;
		this.api = new ParticleApi(settings.apiUrl, { accessToken: this.auth }).api;
		this.ui = new UI({ stdin: process.stdin, stdout: process.stdout, stderr: process.stderr, quiet: false });
	}

	async makeKeyOpenSSL(filename, alg, { protocol }) {
		try {
			const { filenameNoExt, deferredChildProcess } = utilities;

			filename = filenameNoExt(filename);
			alg = alg || this._getPrivateKeyAlgorithm({ protocol });

			if (alg === 'rsa'){
				await deferredChildProcess(`openssl genrsa -out "${filename}.pem" 1024`);
			} else if (alg === 'ec'){
				await deferredChildProcess(`openssl ecparam -name prime256v1 -genkey -out "${filename}.pem"`);
			}

			await deferredChildProcess(`openssl ${alg} -in "${filename}.pem" -pubout -out "${filename}.pub.pem"`);
			await deferredChildProcess(`openssl ${alg} -in "${filename}.pem" -outform DER -out "${filename}.der"`);
		} catch (err) {
			throw new VError(ensureError(err), 'Failed to generate key using OpenSSL');
		}
	}

	keyAlgorithmForProtocol(protocol) {
		return protocol === 'udp' ? 'ec' : 'rsa';
	}

	async makeNewKey({ protocol, params: { filename } }) {
		await this._makeNewKey({ filename: filename || 'device', protocol });
	}

	async _makeNewKey({ filename, protocol, deviceID }) {
		let alg;
		let device;
		try {
			device = await this.getDfuDevice({ deviceID });
			// If protocol is provided, set the algorithm
			if (protocol) {
				alg = this.keyAlgorithmForProtocol(protocol);
			}
			await this.makeKeyOpenSSL(filename, alg, { protocol });
			console.log('New Key Created!');
		} catch (err) {
			throw new VError(ensureError(err), 'Error creating keys');
		} finally {
			if (device) {
				await device.close();
			}
		}
	}

	async writeKeyToDevice({ params: { filename } }) {
		await this._writeKeyToDevice({ filename });
	}

	async _writeKeyToDevice({ filename, leave = false, deviceID }) {
		let device;
		try {
			device = await this.getDfuDevice({ deviceID });

			filename = utilities.filenameNoExt(filename || device.id) + '.der';

			if (!fs.existsSync(filename)){
				throw new VError("I couldn't find the file: " + filename);
			}

			//TODO: give the user a warning before doing this, since it'll bump their device offline.

			const protocol = await this.validateDeviceProtocol({ device });
			let alg = this._getPrivateKeyAlgorithm({ protocol });
			let prefilename = path.join(path.dirname(filename), 'backup_' + alg + '_' + path.basename(filename));
			await this._saveKeyFromDevice({ filename: prefilename, force: true, device });
			let segmentName = this._getPrivateKeySegmentName({ protocol });
			let segment = this._validateSegmentSpecs(segmentName);
			const buffer = fs.readFileSync(filename, null); // 'null' to get the raw data
			await this._dfuWrite(device, buffer, { altSetting: segment.specs.alt, startAddr: segment.specs.address, leave: leave, noErase: true });

			console.log(`Key ${filename} written to device`);
		} catch (err) {
			throw new VError(ensureError(err), 'Error writing key to device.');
		} finally {
			if (device) {
				await device.close();
			}
		}
	}

	async saveKeyFromDevice({ force, params: { filename } }){
		const device = await this.getDfuDevice();
		filename = utilities.filenameNoExt(filename || device.id) + '.der';
		try {
			await this._saveKeyFromDevice({ filename, force, device });
		} finally {
			await device.close();
		}
	}

	async _saveKeyFromDevice({ filename, force, device }) {
		let protocol;
		const { tryDelete, filenameNoExt, deferredChildProcess } = utilities;

		if (!force && fs.existsSync(filename)) {
			throw new VError(`The file ${filename} already exists, please specify a different file, or use the --force flag.`);
		} else if (fs.existsSync(filename)) {
			tryDelete(filename);
		}

		try {
			protocol = await this.validateDeviceProtocol({ device });
			let segmentName = this._getPrivateKeySegmentName({ protocol });
			let segment = this._validateSegmentSpecs(segmentName);
			let buf;

			buf = await this._dfuRead(device, { altSetting: segment.specs.alt, startAddr: segment.specs.address, size: segment.specs.size });

			fs.writeFileSync(filename, buf, 'binary');

			let pubPemFilename = filenameNoExt(filename) + '.pub.pem';
			if (force) {
				tryDelete(pubPemFilename);
			}
			let alg = this._getPrivateKeyAlgorithm({ protocol });
			await deferredChildProcess(`openssl ${alg} -in "${filename}" -inform DER -pubout -out ${pubPemFilename}`)
				.catch((err) => {
					throw new VError(err,
						'Unable to generate a public key from the key downloaded from the device. This usually means you had a corrupt key on the device.');
				});
			console.log(`Saved existing key to ${filename}`);
		} catch (err) {
			return new VError(ensureError(err), 'Error saving key from device');
		}
	}

	async sendPublicKeyToServer({ product_id: productId, params: { deviceID, filename } }){
		await this._sendPublicKeyToServer({ deviceID, filename, productId, algorithm: 'rsa' });
	}

	async _sendPublicKeyToServer({ deviceID, filename, productId, algorithm }) {
		const { filenameNoExt, deferredChildProcess, readFile } = utilities;

		if (!deviceID) {
			// default to the connected device is deviceID is not passed
			let device = await usbUtils.getOneUsbDevice({ ui: this.ui });
			deviceID = device.id;
			await device.close();
		}

		deviceID = deviceID.toLowerCase();
		filename = filename || deviceID;

		if (!fs.existsSync(filename)){
			filename = filenameNoExt(filename) + '.pub.pem';
			if (!fs.existsSync(filename)){
				throw new VError("Couldn't find " + filename);
			}
		}

		let api = new ApiClient();
		api.ensureToken();

		let pubKey = temp.path({ suffix: '.pub.pem' });
		let inform = path.extname(filename).toLowerCase() === '.der' ? 'DER' : 'PEM';
		const cleanup = () => fs.unlinkSync(pubKey);

		try {
			// try both private and public versions and both algorithms
			await deferredChildProcess(`openssl ${algorithm} -inform ${inform} -in "${filename}" -pubout -outform PEM -out "${pubKey}"`)
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

			const keyBuf = await readFile(pubKey);
			let apiAlg = algorithm === 'rsa' ? 'rsa' : 'ecc';
			await api.sendPublicKey(deviceID, keyBuf, apiAlg, productId);
		} catch (err) {
			cleanup();
			throw new VError(ensureError(err), 'Error sending public key to server');
		}
	}

	async keyDoctor({ protocol, params: { deviceID } }) {
		if (deviceID) {
			deviceID = deviceID.toLowerCase(); // make lowercase so that it's case-insensitive

			if (deviceID.length < 24){
				console.log('***************************************************************');
				console.log('   Warning! - device id was shorter than 24 characters - did you use something other than an id?');
				console.log('   use particle identify to find your device id');
				console.log('***************************************************************');
			}
		}

		let algorithm, filename;
		try {
			// TODO: add deviceID here
			const device = await this.getDfuDevice({ deviceID });
			deviceID = device.id;
			await device.close();

			protocol = await this.validateDeviceProtocol({ protocol });
			algorithm = this._getPrivateKeyAlgorithm({ protocol });
			filename = `${deviceID}_${algorithm}_new`;
			await this._makeNewKey({ filename, deviceID });
			await this._writeKeyToDevice({ filename, leave: true, deviceID });
			await this._sendPublicKeyToServer({ deviceID, filename, algorithm });
			console.log('Okay!  New keys in place, your device should restart.');
		} catch (err) {
			throw new VError(ensureError(err), 'Make sure your device is connected to your computer, and that your computer is online.');
		}
	}

	_createAddressBuffer(ipOrDomain){
		const isIpAddress = /^[0-9.]*$/.test(ipOrDomain);

		// create a version of this key that points to a particular server or domain
		const addressBuf = new Buffer(ipOrDomain.length + 2);
		addressBuf[0] = (isIpAddress) ? 0 : 1;
		addressBuf[1] = (isIpAddress) ? 4 : ipOrDomain.length;

		if (isIpAddress){
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

	async writeServerPublicKey({ protocol, host, port, deviceType, params: { filename, outputFilename } }){
		if (deviceType && !filename){
			throw usageError(
				'`filename` parameter is required when `--deviceType` is set'
			);
		}

		if (filename && !fs.existsSync(filename)){
			// TODO UsageError
			throw new VError('Please specify a server key in DER format.');
		}

		let skipDFU = false;
		if (deviceType){
			skipDFU = true;

			// Lookup the DFU ID string that matches the provided deviceType:
			this.dfuId = Object.keys(deviceSpecs)
				.filter(key => deviceSpecs[key].productName.toLowerCase() === deviceType.toLowerCase())[0];
		}

		let device;
		try {
			if (!skipDFU) {
				device = await this.getDfuDevice();
			}
			protocol = await this.validateDeviceProtocol({ protocol, device });

			const derFile = await this._getDERPublicKey(filename, { protocol });
			const bufferFile = await this._formatPublicKey(derFile, host, port, { protocol, outputFilename });

			let segmentName = this._getServerKeySegmentName({ protocol });
			let segment = this._validateSegmentSpecs(segmentName);

			if (!skipDFU) {
				const buffer = fs.readFileSync(bufferFile);
				await this._dfuWrite(device, buffer, { altSetting: segment.specs.alt, startAddr: segment.specs.address, leave: false, noErase: true });
			}

			if (!skipDFU){
				console.log('Okay!  New keys in place, your device will not restart.');
			} else {
				console.log('Okay!  Formatted server key file generated for this type of device.');
			}
		} catch (err) {
			throw new VError(ensureError(err), 'Make sure your device is in DFU mode (blinking yellow), and is connected to your computer.');
		} finally {
			if (device) {
				await device.close();
			}
		}
	}

	async readServerAddress({ protocol }) {
		let device;
		try {
			device = await this.getDfuDevice();

			protocol = await this.validateDeviceProtocol({ protocol, device });

			const serverKeySeg = this._getServerKeySegment({ protocol });

			let segmentName = this._getServerKeySegmentName({ protocol });
			let segment = this._validateSegmentSpecs(segmentName);

			const keyBuf = await this._dfuRead(device, { altSetting: segment.specs.alt, startAddr: segment.specs.address, size: segment.specs.size });

			let offset = serverKeySeg.addressOffset || 384;
			let portOffset = serverKeySeg.portOffset || 450;
			let type = keyBuf[offset];
			let len = keyBuf[offset+1];
			let data = keyBuf.slice(offset + 2, offset + 2 + len);
			let port = keyBuf[portOffset] << 8 | keyBuf[portOffset+1];
			if (port === 0xFFFF){
				port = protocol === 'tcp' ? 5683 : 5684;
			}

			let host = protocol === 'tcp' ? 'device.spark.io' : 'udp.particle.io';

			if (len > 0){
				if (type === 0){
					host = Array.prototype.slice.call(data).join('.');
				} else if (type === 1){
					host = data.toString('utf8');
				}
			}

			let result = { hostname: host, port: port, protocol: protocol, slashes: true };

			console.log();
			console.log(url.format(result));
			return result;
		} catch (err) {
			throw new VError(ensureError(err), 'Make sure your device is in DFU mode (blinking yellow), and is connected to your computer.');
		} finally {
			if (device) {
				await device.close();
			}
		}
	}

	/**
	 * Determines the protocol to use. If a protocol is set in options, that is used.
	 * For single-protocol devices, the default protocol is used. For multi-protocol devices
	 * the device is queried to find the current protocol, and that is used
	 * @param specs The this.dfu device sepcs.
	 * @returns {Promise.<String>}  The
	 */

	async validateDeviceProtocol({ specs, protocol, device } = {}) {
		specs = specs || deviceSpecs[this.dfuId];

		if (protocol) {
			return protocol;
		}

		try {
			const detectedProtocol = await this.fetchDeviceProtocol({ specs, device });
			const supported = [specs.defaultProtocol];
			// eslint-disable-next-line no-mixed-spaces-and-tabs
			if (specs.alternativeProtocol) {
				supported.push(specs.alternativeProtocol);
			}
			if (supported.indexOf(detectedProtocol) < 0) {
				throw new VError(`The device does not support the protocol ${detectedProtocol}. It has support for ${supported.join(', ')}`);
			}
			return detectedProtocol;
		} catch (err) {
			throw new VError(ensureError(err), 'Error validating device protocol');
		}
	}


	_getServerKeySegmentName({ protocol }){
		if (!this.dfuId){
			return;
		}

		let specs = deviceSpecs[this.dfuId];

		if (!specs){
			return;
		}

		return `${protocol || specs.defaultProtocol || 'tcp'}ServerKey`;
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
	async fetchDeviceProtocol({ specs, device }){
		if (specs.transport && specs.alternativeProtocol){
			const buf = await this._dfuRead(device, { altSetting: specs.transport.alt, startAddr: specs.transport.address, size: specs.transport.size });
			return buf[0] === 0xFF ? specs.defaultProtocol : specs.alternativeProtocol;
		} else {
			return specs.defaultProtocol;
		}
	}

	_getServerKeySegment({ protocol }){
		if (!this.dfuId){
			return;
		}

		let specs = deviceSpecs[this.dfuId];
		let segmentName = this._getServerKeySegmentName({ protocol });

		if (!specs || !segmentName){
			return;
		}

		return specs[segmentName];
	}

	_getServerKeyAlgorithm({ protocol }){
		let segment = this._getServerKeySegment({ protocol });

		if (!segment){
			return;
		}

		return segment.alg || 'rsa';
	}

	_getServerKeyVariant({ protocol }){
		let segment = this._getServerKeySegment({ protocol });

		if (!segment){
			return;
		}

		return segment.variant;
	}

	_getPrivateKeySegmentName({ protocol }){
		if (!this.dfuId){
			return;
		}

		let specs = deviceSpecs[this.dfuId];

		if (!specs){
			return;
		}

		return `${protocol || specs.defaultProtocol || 'tcp'}PrivateKey`;
	}

	_getPrivateKeySegment({ protocol }){
		if (!this.dfuId){
			return;
		}

		let specs = deviceSpecs[this.dfuId];
		let segmentName = this._getPrivateKeySegmentName({ protocol });

		if (!specs || !segmentName){
			return;
		}

		return specs[segmentName];
	}

	_getPrivateKeyAlgorithm({ protocol }){
		let segment = this._getPrivateKeySegment({ protocol });
		return (segment && segment.alg) || 'rsa';
	}


	async _getDERPublicKey(filename, { protocol }) {
		const { getFilenameExt, filenameNoExt, deferredChildProcess } = utilities;
		let alg = this._getServerKeyAlgorithm({ protocol });

		if (!alg){
			throw new VError('No device specs');
		}

		let variant = this._getServerKeyVariant({ protocol });

		if (!filename){
			filename = this.serverKeyFilename({ alg, variant });
		}

		if (getFilenameExt(filename).toLowerCase() !== '.der'){
			let derFile = filenameNoExt(filename) + '.der';

			if (!fs.existsSync(derFile)){
				console.log('Creating DER format file');
				try {
					derFile = await deferredChildProcess(`openssl ${alg} -in "${filename}" -pubin -pubout -outform DER -out "${derFile}"`);
					return derFile;
				} catch (err) {
					throw new VError(ensureError(err), 'Error creating a DER formatted version of that key.  Make sure you specified the public key');
				}
			} else {
				return derFile;
			}
		}
		return filename;
	}

	serverKeyFilename({ alg, variant }){
		const basename = variant ? `${alg}-${variant}` : alg;
		return path.join(__dirname, `../../assets/keys/${basename}.pub.der`);
	}

	// eslint-disable-next-line max-statements
	_formatPublicKey(filename, ipOrDomain, port, { protocol, outputFilename }){
		let segment = this._getServerKeySegment({ protocol });

		if (!segment){
			throw new VError('No device specs');
		}

		let buf, fileBuf;

		if (ipOrDomain){
			let alg = segment.alg || 'rsa';
			let fileWithAddress = `${utilities.filenameNoExt(filename)}-${utilities.replaceAll(ipOrDomain, '.', '_')}-${alg}.der`;

			if (outputFilename){
				fileWithAddress = outputFilename;
			}

			let addressBuf = this._createAddressBuffer(ipOrDomain);

			// To generate a file like this, just add a type-length-value (TLV)
			// encoded IP or domain beginning 384 bytes into the file—on external
			// flash the address begins at 0x1180. Everything between the end of
			// the key and the beginning of the address should be 0xFF. The first
			// byte representing "type" is 0x00 for 4-byte IP address or 0x01 for
			// domain name—anything else is considered invalid and uses the
			// fallback domain. The second byte is 0x04 for an IP address or the
			// length of the string for a domain name. The remaining bytes are
			// the IP or domain name. If the length of the domain name is odd,
			// add a zero byte to get the file length to be even as usual.

			buf = new Buffer(segment.size);

			//copy in the key
			fileBuf = fs.readFileSync(filename);
			fileBuf.copy(buf, 0, 0, fileBuf.length);

			//fill the rest with "FF"
			buf.fill(255, fileBuf.length);

			let offset = segment.addressOffset || 384;
			addressBuf.copy(buf, offset, 0, addressBuf.length);

			if (port && segment.portOffset){
				buf.writeUInt16BE(port, segment.portOffset);
			}

			//console.log("address chunk is now: " + addressBuf.toString('hex'));
			//console.log("Key chunk is now: " + buf.toString('hex'));

			fs.writeFileSync(fileWithAddress, buf);
			return fileWithAddress;
		}

		let stats = fs.statSync(filename);

		if (stats.size < segment.size){
			let fileWithSize = `${utilities.filenameNoExt(filename)}-padded.der`;

			if (outputFilename){
				fileWithSize = outputFilename;
			}

			if (!fs.existsSync(fileWithSize)){
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

	async getDfuDevice({ deviceID } = {}) {
		try {
			let device = await usbUtils.getOneUsbDevice({ idOrName: deviceID, api: this.api, auth: this.auth, ui: this.ui });
			if (!device.isInDfuMode) {
				device = await usbUtils.reopenInDfuMode(device);
			}
			this._setDfuId(device);
			return device;
		} catch (err) {
			throw new VError(ensureError(err), 'Unable to get DFU device');
		}
	}

	_validateSegmentSpecs(segmentName) {
		let specs = deviceSpecs[this.dfuId] || {};
		let params = specs[segmentName];
		let error = null;

		if (!segmentName) {
			error = "segmentName required. Don't know where to read/write.";
		} else if (!specs) {
			error = "dfuId has no specification. Don't know how to read/write.";
		} else if (!params) {
			error = `segment ${segmentName} has no specs. Not aware of this segment.`;
		}

		return { error, specs: params };
	}

	async _dfuWrite(device, buffer, { altSetting, startAddr, leave, noErase }) {
		await device.writeOverDfu(buffer, { altSetting, startAddr, leave, noErase });
	}

	async _dfuRead(device, { altSetting, startAddr, size }) {
		let buf;
		try {
			buf = await device.readOverDfu({ altSetting, startAddr, size });
		} catch (err) {
			// FIXME: First time read may fail so we retry
			buf = await device.readOverDfu({ altSetting, startAddr, size });
		}
		return buf;
	}

	_setDfuId(device) {
		// TODO: Remove the usage of dfuId and use device-constants directly
		const vendorId = device._info.vendorId;
		const productId = device._info.productId;
		this.dfuId = vendorId.toString(16).padStart(4, '0') + ':' + productId.toString(16).padStart(4, '0');
	}
};

