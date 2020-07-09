const os = require('os');
const fs = require('fs-extra');
const VError = require('verror');
const settings = require('../../settings');
const { errors: { usageError } } = require('../app/command-processor');
const ParticleAPI = require('./api');
const { normalizedApiError } = require('../lib/api-client');
const { JSONResult } = require('../lib/json-result');
const CLICommandBase = require('./base');


module.exports = class ProductCommand extends CLICommandBase {
	constructor(...args){
		super(...args);
	}

	addDevice({ params: { product, device } }){
		const identifiers = [device];
		const msg = `Adding device ${device} to product ${product}`;
		const upload = uploadProductDevices(product, identifiers);
		return this.ui.showBusySpinnerUntilResolved(msg, upload)
			.then(result => this.showDeviceAddResult(result));
	}

	addDevices({ file, params: { product, device } }){
		if (!device && !file){
			throw usageError(
				'`device` parameter or `--file` option is required'
			);
		}

		if (device){
			if (!this.isDeviceId(device)){
				return this.showUsageError(`\`device\` parameter must be an id - received: ${device}`);
			}
			return this.addDevice({ params: { product, device } });
		}

		const msg = `Adding devices in ${file} to product ${product}`;
		const upload = readDeviceListFile(file).then((identifiers) => uploadProductDevices(product, identifiers));
		return this.ui.showBusySpinnerUntilResolved(msg, upload)
			.then(result => this.showDeviceAddResult(result));
	}

	showDeviceAddResult({ product, identifiers, status: { invalidDeviceIds = [], nonmemberDeviceIds = [] } } = {}){
		identifiers = filterDeviceIdentifiers(identifiers, invalidDeviceIds, nonmemberDeviceIds);
		const message = [];

		if (identifiers.length){
			message.push(
				'Success!',
				'',
				`Product ${product} Includes:`,
				dedupeAndStringifyIDList(identifiers),
				''
			);
		}

		// TODO (mirande): it seems the API never returns this? currently
		// adding a device id which is already in another product yields
		// an api response flagging that id as `invalidDeviceIds`
		if (nonmemberDeviceIds.length){
			message.push(
				'Skipped Non-Member IDs:',
				dedupeAndStringifyIDList(nonmemberDeviceIds),
				''
			);
		}

		if (invalidDeviceIds.length){
			message.push(
				'Skipped Invalid IDs:',
				dedupeAndStringifyIDList(invalidDeviceIds),
				''
			);
		}

		if (!identifiers.length){
			throw new Error(message.join(os.EOL));
		}
		return this.ui.write(message.join(os.EOL));
	}

	showDeviceDetail({ json, params: { product, device } }){
		const msg = `Fetching device ${device} detail`;
		const fetchData = createAPI().getDeviceAttributes(device, product);
		return (json ? fetchData : this.ui.showBusySpinnerUntilResolved(msg, fetchData))
			.then(res => {
				if (json){
					this.ui.stdout.write(
						createJSONResult(null, res)
					);
				} else {
					this.ui.logDeviceDetail(res);
				}
			})
			.catch(error => {
				const message = 'Error showing product device detail';
				throw createAPIErrorResult({ error, message, json });
			});
	}

	showDeviceList({ name, page = 1, limit, groups, json, params: { product, device } }){
		if (device){
			return this.showDeviceDetail({ json, params: { product, device } });
		}
		const msg = `Fetching product ${product} device list`;
		const fetchData = createAPI().listDevices({ product, page, groups, perPage: limit, deviceName: name });
		return (json ? fetchData : this.ui.showBusySpinnerUntilResolved(msg, fetchData))
			.then(res => {
				if (json){
					this.ui.stdout.write(
						createJSONResult(page, res.devices)
					);
				} else {
					this.ui.logDeviceDetail(res.devices);
				}
			})
			.catch(error => {
				const message = 'Error listing product devices';
				throw createAPIErrorResult({ error, message, json });
			});
	}
};


// UTILS //////////////////////////////////////////////////////////////////////
function createAPI(){
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}

function createJSONResult(page, data){
	const meta = typeof page === 'number'
		? { previous: page - 1, current: page, next: page + 1 }
		: {};

	return new JSONResult(meta, data).toString();
}

function createAPIErrorResult({ error: e, message, json }){
	const error = new VError(normalizedApiError(e), message);
	error.asJSON = json;
	return error;
}

function uploadProductDevices(product, identifiers){
	const file = Buffer.from(identifiers.join('\n'), 'utf8');

	return createAPI()
		.addDeviceToProduct(null, product, file)
		.then(status => ({ product, identifiers, status }))
		.catch(error => {
			const message = 'Error adding device(s) to product';
			throw createAPIErrorResult({ error, message, json: false });
		});
}

function readDeviceListFile(file){
	return fs.readFile(file, 'utf8')
		.then((data) => {
			return data
				.split(/\r?\n/)
				.map(l => l.trim())
				.filter(l => !!l);
		})
		.then(identifiers => {
			if (!identifiers.length){
				throw new Error(`${file} is empty`);
			}
			return identifiers;
		})
		.catch(error => {
			if (error.code === 'ENOENT'){
				throw new Error(`${file} does not exist`);
			}
			throw error;
		});
}

function filterDeviceIdentifiers(identifiers, invalid = [], nonmember = []){
	return identifiers.reduce((out, x) => {
		if (!hasDeviceIdentifier(x, invalid) && !hasDeviceIdentifier(x, nonmember)){
			out.push(x);
		}
		return out;
	}, []);
}

function hasDeviceIdentifier(x = '', ids = []){
	x = x.toLowerCase().trim();

	return ids
		.map(id => id.toLowerCase().trim())
		.some(id => id === x);
}

function dedupeAndStringifyIDList(array){
	return `  ${[...new Set(array)].join(`${os.EOL}  `)}`;
}

