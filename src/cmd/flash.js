const fs = require('fs-extra');
const ParticleApi = require('./api');
const VError = require('verror');
const ModuleParser = require('binary-version-reader').HalModuleParser;
const ModuleInfo = require('binary-version-reader').ModuleInfo;
const deviceSpecs = require('../lib/device-specs');
const ensureError = require('../lib/utilities').ensureError;
const { errors: { usageError } } = require('../app/command-processor');
const dfu = require('../lib/dfu');
const CLICommandBase = require('./base');

module.exports = class FlashCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	async _parseLocalFlashArguments({  binary, files }) {
		const parsedFiles = [...files];
		let device = undefined;
		if (!binary && !files.length) {
			parsedFiles.push('.');
		} else {
			try {
				const stats = await fs.stat(binary);
				if (stats.isFile() || stats.isDirectory()) {
					parsedFiles.push(binary);
					device = undefined; // Reset device if it's a file or directory
				}
			} catch (error) {
				// file does not exist
				device = binary;
				parsedFiles.push('.');
			}

		}
		return {
			device: device,
			files: parsedFiles,
		};
	}

	async flash(device, binary, files, { local, usb, serial, factory, force, target, port, yes, 'application-only': applicationOnly }){
		if (!device && !binary && !local){
			// if no device nor files are passed, show help
			throw usageError('You must specify a device or a file');
		}

		this.ui.logFirstTimeFlashWarning();

		if (usb){
			await this.flashDfu({ binary, factory, force });
		} else if (serial){
			await this.flashYModem({ binary, port, yes });
		} else if (local){
			// TODO: implement local flash
			// Analyze argument list to determine user intent
			const { device: deviceIdentifier, files: parsedFiles } = await this._parseLocalFlashArguments({ binary, files });

			console.log(deviceIdentifier, parsedFiles, applicationOnly);
		} else {
			await this.flashCloud({ device, files, target });
		}

		this.ui.write('Flash success!');
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
					return;
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
					});
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

				let segmentName;
				if (factory) {
					if (info.prefixInfo.moduleFunction !== ModuleInfo.FunctionType.USER_PART) {
						throw new Error('Cannot flash a non-application binary to the factory reset location');
					}
					segmentName = 'factoryReset';
					if (!specs[segmentName]) {
						throw new Error('The platform does not support a factory reset application');
					}
				}

				if (requestLeave === undefined) {
					// todo - leave on factory firmware write too?
					requestLeave = (!factory && info.prefixInfo.moduleFunction === ModuleInfo.FunctionType.USER_PART);
				}

				return dfu.writeModule(binary, { segmentName, leave: requestLeave });
			})
			.catch((err) => {
				throw new VError(ensureError(err), 'Error writing firmware');
			});
	}
};

