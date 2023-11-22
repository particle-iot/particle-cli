const ParticleAPI = require('./api');
const VError = require('verror');
const settings = require('../../settings');
const { normalizedApiError } = require('../lib/api-client');
const CLICommandBase = require('./base');
const os = require('os');

/**
 * Commands for managing encryption keys.
 * @constructor
 */
module.exports = class LogicFunctionsCommand extends CLICommandBase {
	constructor(...args) {
		super(...args);
	}

	async list({ org }) {
		const api = createAPI();
		try {
			const logicFunctions = await api.getLogicFunctionList({ org });
			const orgName = getOrgName(org);
			const list = logicFunctions['logic_functions'];
			if (list.length === 0) {
				this.ui.stdout.write(`No Logic Functions currently deployed in your ${orgName}.`);
				this.ui.stdout.write(`To create a Logic Function, see \`particle logic-function create\`.${os.EOL}
							To view Functions from an organization, use the \`--org\` option.${os.EOL}
							To download an existing Logic Function, see \`particle lf get\`.${os.EOL}`);
			} else {
				this.ui.stdout.write(`Logic Functions currently deployed in your ${orgName}:${os.EOL}`);
				list.forEach((item) => {
					// We assume atleast one trigger
					this.ui.stdout.write(`- ${item.name} (${ item.enabled ? this.ui.chalk.cyanBright('enabled') : this.ui.chalk.grey('disabled') })${os.EOL}`);
					this.ui.stdout.write(`	- ID: ${item.id}${os.EOL}`);
					this.ui.stdout.write(`	- ${item.logic_triggers[0].type} based trigger ${os.EOL}`);
				});
				this.ui.stdout.write(`${os.EOL}To view a Logic Function's code, see \`particle lf get.\`${os.EOL}`);
			}
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
		}
	}


	async get({ org, name, id }) {
		// TODO
		console.log(org, name, id);
	}

	async create({ org, params: { filepath } }) {
		// TODO
		console.log(org, filepath);
	}

	async execute({ org, data, params: { filepath } }) {
		// TODO
		console.log(org, data, filepath);
	}

	async deploy({ org, params: { filepath } }) {
		// TODO
		console.log(org, filepath);
	}

	async disable({ org, name, id }) {
		// TODO
		console.log(org, name, id);
	}

	async delete({ org, name, id }) {
		// TODO
		console.log(org, name, id);
	}

	async logs({ org, name, id, saveTo }) {
		// TODO
		console.log(org, name, id, saveTo);
	}
};

// UTILS //////////////////////////////////////////////////////////////////////
function createAPI() {
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}

function createAPIErrorResult({ error: e, message, json }){
	const error = new VError(formatAPIErrorMessage(e), message);
	error.asJSON = json;
	return error;
}

// get org name from org slug
function getOrgName(org) {
	return org || 'Staging';
}

// TODO (mirande): reconcile this w/ `normalizedApiError()` and `ensureError()`
// utilities and pull the result into cmd/api.js
function formatAPIErrorMessage(error){
	error = normalizedApiError(error);

	if (error.body){
		if (typeof error.body.error === 'string'){
			error.message = error.body.error;
		} else if (Array.isArray(error.body.errors)){
			if (error.body.errors.length === 1){
				error.message = error.body.errors[0];
			}
		}
	}

	if (error.message.includes('That belongs to someone else.')){
		error.canRequestTransfer = true;
	}

	return error;
}

module.exports.createAPI = createAPI;
