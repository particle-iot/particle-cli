const fs = require('fs');
const VError = require('verror');
const temp = require('temp').track();
const ModuleParser = require('binary-version-reader').HalModuleParser;
const ModuleInfo = require('binary-version-reader').ModuleInfo;
const deviceSpecs = require('../lib/device-specs');
const { dfuInterfaceForFirmwareModule, ensureError } = require('../lib/utilities');
const dfu = require('../lib/dfu');
const CLICommandBase = require('./base');

const systemModuleIndexToString = {
	1: 'systemFirmwareOne',
	2: 'systemFirmwareTwo',
	3: 'systemFirmwareThree'
};


module.exports = class FlashCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}
	flash(device, binary, files, { usb, serial, factory, force, target, port, yes }){
		if (!device && !binary){
			// if no device nor files are passed, show help
			// TODO: Replace by UsageError
			return Promise.reject();
		}

		this.ui.logFirstTimeFlashWarning();

		let result;
		if (usb){
			result = this.flashDfu({ binary, factory, force });
		} else if (serial){
			result = this.flashYModem({ binary, port, yes });
		} else {
			result = this.flashCloud({ device, files, target });
		}

		return result.then(() => {
			this.ui.write('\nFlash success!');
		});
	}

	flashCloud({ device, files, target }){
		const CloudCommands = require('../cmd/cloud');
		const args = { target, params: { device, files } };
		return new CloudCommands().flashDevice(args);
	}

	flashYModem({ binary, port, yes }){
		const SerialCommands = require('../cmd/serial');
		return new SerialCommands().flashDevice(binary, { port, yes });
	}

	flashDfu({ binary, factory, force, requestLeave }){
		let destAddress, alt;
		return Promise.resolve()
			.then(() => dfu.isDfuUtilInstalled())
			.then(() => dfu.findCompatibleDFU())
			.then(() => {
				//only match against knownApp if file is not found
				let stats;

				try {
					stats = fs.statSync(binary);
				} catch (error){
					// file does not exist
					binary = dfu.checkKnownApp(binary);

					if (binary === undefined){
						throw new Error(`file does not exist and no known app found. tried: \`${error.path}\``);
					}
					return binary;
				}

				if (!stats.isFile()){
					throw new Error('You cannot flash a directory over USB');
				}
			})
			.then(() => {
				const parser = new ModuleParser();
				return parser.parseFile(binary)
					.catch(err => {
						throw new VError(ensureError(err), `Could not parse ${binary}`);
					})
					.then(info => {
						if (info.suffixInfo.suffixSize === 65535){
							this.ui.write('warn: unable to verify binary info');
							return;
						}

						if (!info.crc.ok && !force){
							throw new Error('CRC is invalid, use --force to override');
						}

						const specs = deviceSpecs[dfu.dfuId];
						if (info.prefixInfo.platformID !== specs.productId && !force){
							throw new Error(`Incorrect platform id (expected ${specs.productId}, parsed ${info.prefixInfo.platformID}), use --force to override`);
						}

						if (factory) {
							if (info.prefixInfo.moduleFunction !== ModuleInfo.FunctionType.USER_PART) {
								throw new Error('Cannot flash a non-application binary to the factory reset location');
							}
							const spec = specs.factoryReset;
							if (!spec || spec.address === undefined || spec.alt === undefined) {
								throw new Error('The platform does not support a factory reset application');
							}
							destAddress = spec.address;
							alt = spec.alt;
						} else {
							alt = dfuInterfaceForFirmwareModule(info.prefixInfo.moduleFunction, info.prefixInfo.moduleIndex,
									info.prefixInfo.platformID);
							if (alt === null) {
								throw new Error('A firmware module of this type cannot be flashed via DFU');
							}
							destAddress = '0x' + info.prefixInfo.moduleStartAddy;
						}

						if (requestLeave === undefined) {
							// todo - leave on factory firmware write too?
							requestLeave = (!factory && info.prefixInfo.moduleFunction === ModuleInfo.FunctionType.USER_PART);
						}

						if (info.prefixInfo.moduleFlags & ModuleInfo.Flags.DROP_MODULE_INFO){
							return this._dropModuleInfo(binary);
						}

						return binary;
					});
			})
			.then((finalBinary) => {
				return dfu.writeDfu(alt, finalBinary, destAddress, requestLeave);
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

