const fs = require('fs');
const VError = require('verror');
const dfu = require('../lib/dfu');
const ModuleParser = require('binary-version-reader').HalModuleParser;
const ModuleInfo = require('binary-version-reader').ModuleInfo;
const deviceSpecs = require('../lib/deviceSpecs');
const ensureError = require('../lib/utilities').ensureError;
const temp = require('temp').track();

const systemModuleIndexToString = {
	1: 'systemFirmwareOne',
	2: 'systemFirmwareTwo',
	3: 'systemFirmwareThree'
};


module.exports = class FlashCommand {
	flash(device, binary, files, { usb, serial, factory, force, target, port, yes }){
		if (!device && !binary){
			// if no device nor files are passed, show help
			// TODO: Replace by UsageError
			return Promise.reject();
		}

		let result;
		if (usb){
			result = this.flashDfu({ binary, factory, force });
		} else if (serial){
			result = this.flashYModem({ binary, port, yes });
		} else {
			result = this.flashCloud({ device, files, target, yes });
		}

		return result.then(() => {
			console.log ('\nFlash success!');
		});
	}

	flashCloud({ device, files, target, yes }){
		const CloudCommands = require('../cmd/cloud');
		return new CloudCommands().flashDevice(device, files, { target, yes });
	}

	flashYModem({ binary, port, yes }){
		const SerialCommands = require('../cmd/serial');
		return new SerialCommands().flashDevice(binary, { port, yes });
	}

	flashDfu({ binary, factory, force, requestLeave }){
		let specs, destSegment, destAddress;
		let flashingKnownApp = false;
		return Promise.resolve()
			.then(() => dfu.isDfuUtilInstalled())
			.then(() => dfu.findCompatibleDFU())
			.then(() => {
				//only match against knownApp if file is not found
				let stats;

				try {
					stats = fs.statSync(binary);
				} catch (ex){
					// file does not exist
					binary = dfu.checkKnownApp(binary);

					if (binary === undefined){
						throw new Error('file does not exist and no known app found.');
					} else {
						flashingKnownApp = true;
						return binary;
					}
				}

				if (!stats.isFile()){
					throw new Error('You cannot flash a directory over USB');
				}
			})
			.then(() => {
				destSegment = factory ? 'factoryReset' : 'userFirmware';

				if (flashingKnownApp){
					return binary;
				}

				const parser = new ModuleParser();
				return parser.parseFile(binary)
					.catch(err => {
						throw new VError(ensureError(err), `Could not parse ${binary}`);
					})
					.then(info => {
						if (info.suffixInfo.suffixSize === 65535){
							console.log('warn: unable to verify binary info');
							return;
						}

						if (!info.crc.ok && !force){
							throw new Error('CRC is invalid, use --force to override');
						}

						specs = deviceSpecs[dfu.dfuId];
						if (info.prefixInfo.platformID !== specs.productId && !force){
							throw new Error(`Incorrect platform id (expected ${specs.productId}, parsed ${info.prefixInfo.platformID}), use --force to override`);
						}

						switch (info.prefixInfo.moduleFunction){
							case ModuleInfo.FunctionType.MONO_FIRMWARE:
								// only override if modular capable
								destSegment = specs.systemFirmwareOne ? 'systemFirmwareOne' : destSegment;
								break;
							case ModuleInfo.FunctionType.SYSTEM_PART:
								destSegment = systemModuleIndexToString[info.prefixInfo.moduleIndex];
								destAddress = '0x0' + info.prefixInfo.moduleStartAddy;
								break;
							case ModuleInfo.FunctionType.USER_PART:
								// use existing destSegment for userFirmware/factoryReset
								break;
							case ModuleInfo.FunctionType.RADIO_STACK:
								destSegment = 'radioStack';
								destAddress = '0x0' + info.prefixInfo.moduleStartAddy;
								break;
							default:
								if (!force){
									throw new Error('unknown module function ' + info.prefixInfo.moduleFunction + ', use --force to override');
								}
								break;
						}

						if (info.prefixInfo.moduleFlags & ModuleInfo.Flags.DROP_MODULE_INFO){
							return this._dropModuleInfo(binary);
						}

						return binary;
					});
			})
			.then((finalBinary) => {
				if (!destAddress && destSegment){
					const segment = dfu._validateSegmentSpecs(destSegment);
					if (segment.error){
						throw new Error('dfu.write: ' + segment.error);
					}
					destAddress = segment.specs.address;
				}

				if (!destAddress){
					throw new Error('Unknown destination');
				}

				const alt = 0;
				// todo - leave on factory firmware write too?
				const leave = requestLeave !== undefined ? requestLeave : (destSegment === 'userFirmware');
				return dfu.writeDfu(alt, finalBinary, destAddress, leave);
			})
			.catch((err) => {
				throw new VError(ensureError(err), 'Error writing firmware');
			});
	}

	_dropModuleInfo(binary){
		// Creates a temporary binary with module info stripped out and returns the path to it

		return new Promise((resolve, reject) => {
			const rStream = fs.createReadStream(binary, { start: ModuleInfo.HEADER_SIZE });
			const wStream = temp.createWriteStream({ suffix: '.bin' });
			rStream.pipe(wStream)
				.on('error', reject)
				.on('finish', () => resolve(wStream.path));
		});
	}
};

