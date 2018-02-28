const when = require('when');
const sequence = require('when/sequence');

const fs = require('fs');
const dfu = require('../lib/dfu.js');
const ModuleParser = require('binary-version-reader').HalModuleParser;
const deviceSpecs = require('../lib/deviceSpecs');

const MONOLITHIC = 3;
const SYSTEM_MODULE = 4;
const APPLICATION_MODULE = 5;

const systemModuleIndexToString = {
	1: 'systemFirmwareOne',
	2: 'systemFirmwareTwo',
	3: 'systemFirmwareThree'
};

class FlashCommand {
	constructor(options) {
		this.options = options;
	}

	flash() {
		if (!this.options.params.device) {
			// if no device nor files are passed, show help
			return when.reject();
		}

		let result;
		if (this.options.usb) {
			result = this.flashDfu();
		} else if (this.options.serial) {
			result = this.flashYModem();
		} else {
			result = this.flashCloud();
		}

		return result;
	}

	flashCloud() {
		const args = {
			params: {
				device: this.options.params.device,
				files: this.options.params.files,
			}
		};
		const CloudCommands = require('../cmd/cloud');
		return new CloudCommands(args).flashDevice();
	}

	flashYModem() {
		const args = {
			params: {
				binary: this.options.params.device
			}
		};
		const SerialCommands = require('../cmd/serial');
		return new SerialCommands(args).flashDevice();
	}

	flashDfu() {
		const useFactory = this.options.useFactoryAddress;
		let firmware = this.options.params.device;

		let specs, destSegment, destAddress;
		let flashingKnownApp = false;
		const ready = sequence([
			() => {
				return dfu.isDfuUtilInstalled();
			},
			() => {
				return dfu.findCompatibleDFU();
			},
			() => {
				//only match against knownApp if file is not found
				let stats;
				try {
					stats = fs.statSync(firmware);
				} catch (ex) {
					// file does not exist
					firmware = dfu.checkKnownApp(firmware);
					if (firmware === undefined) {
						return when.reject('file does not exist and no known app found.');
					} else {
						flashingKnownApp = true;
						return firmware;
					}
				}

				if (!stats.isFile()){
					return when.reject('You cannot flash a directory over USB');
				}
			},
			() => {
				destSegment = useFactory ? 'factoryReset' : 'userFirmware';
				if (flashingKnownApp) {
					return when.resolve();
				}

				return when.promise((resolve, reject) => {
					const parser = new ModuleParser();
					parser.parseFile(firmware, (info, err) => {
						if (err) {
							return reject(err);
						}

						if (info.suffixInfo.suffixSize === 65535) {
							console.log('warn: unable to verify binary info');
							return resolve();
						}

						if (!info.crc.ok && !this.options.force) {
							return reject('CRC is invalid, use --force to override');
						}

						specs = deviceSpecs[dfu.dfuId];
						if (info.prefixInfo.platformID !== specs.productId && !this.options.force) {
							return reject(`Incorrect platform id (expected ${specs.productId}, parsed ${info.prefixInfo.platformID}), use --force to override`);
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
								if (!this.options.force) {
									return reject('unknown module function ' + info.prefixInfo.moduleFunction + ', use --force to override');
								}
								break;
						}
						resolve();
					});
				});
			},
			() => {
				if (!destAddress && destSegment) {
					const segment = dfu._validateSegmentSpecs(destSegment);
					if (segment.error) {
						return when.reject('dfu.write: ' + segment.error);
					}
					destAddress = segment.specs.address;
				}
				if (!destAddress) {
					return when.reject('Unknown destination');
				}
				const alt = 0;
				const leave = destSegment === 'userFirmware';  // todo - leave on factory firmware write too?
				return dfu.writeDfu(alt, firmware, destAddress, leave);
			}
		]);

		return ready.then(() => {
			console.log ('\nFlash success!');
		}, (err) => {
			console.error('\nError writing firmware...' + err + '\n');
			return when.reject();
		});
	}
}


module.exports = FlashCommand;
