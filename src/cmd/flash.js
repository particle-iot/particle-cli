const fs = require('fs');
const VError = require('verror');
const dfu = require('../lib/dfu.js');
const ModuleParser = require('binary-version-reader').HalModuleParser;
const deviceSpecs = require('../lib/deviceSpecs');
const ensureError = require('../lib/utilities').ensureError;

const MONOLITHIC = 3;
const SYSTEM_MODULE = 4;
const APPLICATION_MODULE = 5;

const systemModuleIndexToString = {
	1: 'systemFirmwareOne',
	2: 'systemFirmwareTwo',
	3: 'systemFirmwareThree'
};

class FlashCommand {
	flash(device, binary, files, { usb, serial, factory, force, target, port, yes }) {
		if (!device && !binary) {
			// if no device nor files are passed, show help
			// TODO: Replace by UsageError
			return Promise.reject();
		}

		let result;
		if (usb) {
			result = this.flashDfu({ binary, factory, force });
		} else if (serial) {
			result = this.flashYModem({ binary, port, yes });
		} else {
			result = this.flashCloud({ device, files, target, yes });
		}

		return result;
	}

	flashCloud({ device, files, target, yes }) {
		const CloudCommands = require('../cmd/cloud');
		return new CloudCommands().flashDevice(device, files, { target, yes });
	}

	flashYModem({ binary, port, yes }) {
		const SerialCommands = require('../cmd/serial');
		return new SerialCommands().flashDevice(binary, { port, yes });
	}


	flashDfu({ binary, factory, force }) {
		let specs, destSegment, destAddress;
		let flashingKnownApp = false;
		return Promise.resolve().then(() => {
			return dfu.isDfuUtilInstalled();
		}).then(() => {
			return dfu.findCompatibleDFU();
		}).then(() => {
			//only match against knownApp if file is not found
			let stats;
			try {
				stats = fs.statSync(binary);
			} catch (ex) {
				// file does not exist
				binary = dfu.checkKnownApp(binary);
				if (binary === undefined) {
					throw new Error('file does not exist and no known app found.');
				} else {
					flashingKnownApp = true;
					return binary;
				}
			}

			if (!stats.isFile()){
				throw new Error('You cannot flash a directory over USB');
			}
		}).then(() => {
			destSegment = factory ? 'factoryReset' : 'userFirmware';
			if (flashingKnownApp) {
				return;
			}

			const parser = new ModuleParser();
			return parser.parseFile(binary).catch(err => {
				throw new VError(ensureError(err), `Could not parse ${binary}`);
			}).then(info => {
				if (info.suffixInfo.suffixSize === 65535) {
					console.log('warn: unable to verify binary info');
					return;
				}

				if (!info.crc.ok && !force) {
					throw new Error('CRC is invalid, use --force to override');
				}

				specs = deviceSpecs[dfu.dfuId];
				if (info.prefixInfo.platformID !== specs.productId && !force) {
					throw new Error(`Incorrect platform id (expected ${specs.productId}, parsed ${info.prefixInfo.platformID}), use --force to override`);
				}

				switch (info.prefixInfo.moduleFunction) {
					case MONOLITHIC:
						// only override if modular capable
						destSegment = specs.systemFirmwareOne ? 'systemFirmwareOne' : destSegment;
						break;
					case SYSTEM_MODULE:
						destSegment = systemModuleIndexToString[info.prefixInfo.moduleIndex];
						destAddress = '0x0' + info.prefixInfo.moduleStartAddy;
						break;
					case APPLICATION_MODULE:
						// use existing destSegment for userFirmware/factoryReset
						break;
					default:
						if (!force) {
							throw new Error('unknown module function ' + info.prefixInfo.moduleFunction + ', use --force to override');
						}
						break;
				}
			});
		}).then(() => {
			if (!destAddress && destSegment) {
				const segment = dfu._validateSegmentSpecs(destSegment);
				if (segment.error) {
					throw new Error('dfu.write: ' + segment.error);
				}
				destAddress = segment.specs.address;
			}
			if (!destAddress) {
				throw new Error('Unknown destination');
			}
			const alt = 0;
			const leave = destSegment === 'userFirmware';  // todo - leave on factory firmware write too?
			return dfu.writeDfu(alt, binary, destAddress, leave);
		}).then(() => {
			console.log ('\nFlash success!');
		}).catch((err) => {
			throw new VError(ensureError(err), 'Error writing firmware');
		});
	}
}


module.exports = FlashCommand;
