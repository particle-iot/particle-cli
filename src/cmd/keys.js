const fs = require('fs');
const url = require('url');
const path = require('path');
const settings = require('../../settings');
const usbUtils = require('./usb-util');
const VError = require('verror');
const temp = require('temp').track();
const utilities = require('../lib/utilities');
const ApiClient = require('../lib/api-client');
const { keysDctOffsets } = require('../lib/keys-specs');
const deviceConstants = require('@particle/device-constants');
const ensureError = require('../lib/utilities').ensureError;
const { errors: { usageError } } = require('../app/command-processor');
const UI = require('../lib/ui');
const ParticleApi = require('./api');
const { validateDFUSupport } = require('../lib/flash-helper');

/**
 * Commands for managing encryption keys.
 * @constructor
 */
module.exports = class KeysCommand {
	constructor(){
		this.platform = null;
		this.auth = settings.access_token;
		this.api = new ParticleApi(settings.apiUrl, { accessToken: this.auth }).api;
		this.ui = new UI({ stdin: process.stdin, stdout: process.stdout, stderr: process.stderr, quiet: false });
	}

	async makeKeyOpenSSL(filename, alg) {
		try {
			const { filenameNoExt, deferredChildProcess } = utilities;

			filename = filenameNoExt(filename);

			if (alg === 'rsa'){
				await deferredChildProcess(`openssl genrsa -out "${filename}.pem" 1024`);
			} else if (alg === 'ec'){
				await deferredChildProcess(`openssl ecparam -name prime256v1 -genkey -out "${filename}.pem"`);
			}

			await deferredChildProcess(`openssl ${alg} -in "${filename}.pem" -pubout -out "${filename}.pub.pem"`);
			await deferredChildProcess(`openssl ${alg} -in "${filename}.pem" -outform DER -out "${filename}.der"`);
			return `${filename}.der`;
		} catch (err) {
			throw new VError(ensureError(err), 'Failed to generate key using OpenSSL');
		}
	}

	async makeNewKey({ params: { filename } }) {
		await this._makeNewKey({ filename });
	}

	async _makeNewKey({ filename, deviceID }) {
		let device;
		try {
			device = await this.getDfuDevice({ deviceID });
			const protocol = this._getDeviceProtocol();
			const alg = this._getPrivateKeyAlgorithm({ protocol });
			filename = await this.makeKeyOpenSSL(filename || device.id, alg);
			console.log(`New key ${path.basename(filename)} created for device ${device.id}`);
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

			const protocol = this._getDeviceProtocol();
			const alg = this._getPrivateKeyAlgorithm({ protocol });
			let prefilename = path.join(path.dirname(filename), 'backup_' + alg + '_' + path.basename(filename));
			await this._saveKeyFromDevice({ filename: prefilename, force: true, device });
			let segment = this._getPrivateKeySegment({ protocol });
			const buffer = fs.readFileSync(filename, null); // 'null' to get the raw data
			await this._dfuWrite(device, buffer, { altSetting: segment.alt, startAddr: segment.address, leave: leave, noErase: true });

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
		const { tryDelete, filenameNoExt, deferredChildProcess } = utilities;

		if (!force && fs.existsSync(filename)) {
			throw new VError(`The file ${filename} already exists, please specify a different file, or use the --force flag.`);
		} else if (fs.existsSync(filename)) {
			tryDelete(filename);
		}

		try {
			const protocol = this._getDeviceProtocol();
			let segment = this._getPrivateKeySegment({ protocol });

			const buf = await this._dfuRead(device, { altSetting: segment.alt, startAddr: segment.address, size: segment.size });

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
		await this._sendPublicKeyToServer({ deviceID, filename, productId });
	}

	async _sendPublicKeyToServer({ deviceID, filename, productId }) {
		const { filenameNoExt, deferredChildProcess, readFile } = utilities;

		if (!deviceID) {
			// default to the connected device if deviceID is not passed
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
			let algorithm = 'rsa';
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

	async keyDoctor({ params: { deviceID } }) {
		if (deviceID) {
			deviceID = deviceID.toLowerCase(); // make lowercase so that it's case-insensitive

			if (deviceID.length < 24){
				console.log('***************************************************************');
				console.log('   Warning! - device id was shorter than 24 characters - did you use something other than an id?');
				console.log('   use particle identify to find your device id');
				console.log('***************************************************************');
			}
		}

		try {
			const device = await this.getDfuDevice({ deviceID });
			deviceID = device.id;
			await device.close();

			const protocol = this._getDeviceProtocol();
			const algorithm = this._getPrivateKeyAlgorithm({ protocol });
			const filename = `${deviceID}_${algorithm}_new`;
			await this._makeNewKey({ filename, deviceID });
			await this._writeKeyToDevice({ filename, leave: true, deviceID });
			await this._sendPublicKeyToServer({ deviceID, filename, algorithm });
			console.log('Okay!  New keys in place, your device should restart.');
		} catch (err) {
			throw new VError(ensureError(err), 'Make sure your device is connected to your computer, and that your computer is online');
		}
	}

	_createAddressBuffer(ipOrDomain){
		const isIpAddress = /^[0-9.]*$/.test(ipOrDomain);

		// create a version of this key that points to a particular server or domain
		const addressBuf = Buffer.alloc(ipOrDomain.length + 2);
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

	async writeServerPublicKey({ host, port, deviceType, params: { filename, outputFilename } }){
		if (deviceType && !filename){
			throw usageError(
				'`filename` parameter is required when `--deviceType` is set'
			);
		}

		if (filename && !fs.existsSync(filename)){
			// TODO UsageError
			throw new VError('Please specify a server key in DER format.');
		}

		let device;
		try {
			let noDevice = false;
			if (deviceType) {
				if (!deviceConstants[deviceType]) {
					throw new VError(`Unknown device type ${deviceType}. Use one of ${Object.keys(deviceConstants).join(', ')}`);
				}
				this.platform = deviceType;
				noDevice = true;
			} else {
				device = await this.getDfuDevice();
			}

			const protocol = this._getDeviceProtocol();
			const derFile = await this._getDERPublicKey(filename, { protocol });
			const bufferFile = await this._formatPublicKey(derFile, host, port, { protocol, outputFilename });

			const segment = this._getServerKeySegment({ protocol });

			if (!noDevice) {
				const buffer = fs.readFileSync(bufferFile);
				await this._dfuWrite(device, buffer, { altSetting: segment.alt, startAddr: segment.address, leave: false, noErase: true });
			}

			if (!noDevice){
				console.log('Okay!  New keys in place, your device will not restart.');
			} else {
				console.log('Okay!  Formatted server key file generated for this type of device.');
			}
		} catch (err) {
			throw new VError(ensureError(err), 'Make sure your device is connected to your computer');
		} finally {
			if (device) {
				await device.close();
			}
		}
	}

	async readServerAddress() {
		let device;
		try {
			device = await this.getDfuDevice();

			const protocol = this._getDeviceProtocol();
			const segment = this._getServerKeySegment({ protocol });

			const keyBuf = await this._dfuRead(device, { altSetting: segment.alt, startAddr: segment.address, size: segment.size });

			let offset = segment.addressOffset || 384;
			let portOffset = segment.portOffset || 450;
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
			throw new VError(ensureError(err), 'Make sure your device is connected to your computer');
		} finally {
			if (device) {
				await device.close();
			}
		}
	}

	_getServerKeySegment({ protocol }){
		let segmentName = `${protocol}ServerKey`;
		return this._getDctKeySegments()[segmentName];
	}

	_getServerKeyAlgorithm({ protocol }){
		let segment = this._getServerKeySegment({ protocol });
		return segment.alg;
	}

	_getPrivateKeySegment({ protocol }){
		let segmentName = `${protocol}PrivateKey`;
		return this._getDctKeySegments()[segmentName];
	}

	_getPrivateKeyAlgorithm({ protocol }){
		let segment = this._getPrivateKeySegment({ protocol });
		return segment.alg;
	}

	async _getDERPublicKey(filename, { protocol }) {
		const { getFilenameExt, filenameNoExt, deferredChildProcess } = utilities;
		let alg = this._getServerKeyAlgorithm({ protocol });

		if (!alg){
			throw new VError('Unable to get the algorithm for that protocol');
		}

		if (!filename){
			filename = this.serverKeyFilename({ alg });
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

	serverKeyFilename({ alg }){
		return path.join(__dirname, `../../assets/keys/${alg}.pub.der`);
	}

	// eslint-disable-next-line max-statements
	_formatPublicKey(filename, ipOrDomain, port, { protocol, outputFilename }){
		let segment = this._getServerKeySegment({ protocol });

		if (!segment){
			throw new VError('No segment found for that protocol');
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

			buf = Buffer.alloc(segment.size);

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
				buf = Buffer.alloc(segment.size);
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
		let device = await usbUtils.getOneUsbDevice({ idOrName: deviceID, api: this.api, auth: this.auth, ui: this.ui });
		if (!device.isInDfuMode) {
			validateDFUSupport({ device, ui: this.ui });
			device = await usbUtils.reopenInDfuMode(device);
		}
		this.platform = device._info.type;
		return device;
	}

	_getDctKeySegments() {
		if (this.platform === 'core') {
			return keysDctOffsets['generation1'];
		} else {
			return keysDctOffsets['laterGenerations'];
		}
	}

	_getDeviceProtocol() {
		return deviceConstants[this.platform].features.includes('tcp') ? 'tcp' : 'udp';
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
};

