const ParticleAPI = require('./api');
const VError = require('verror');
const settings = require('../../settings');
const { normalizedApiError } = require('../lib/api-client');
const chalk = require('chalk');

/**
 * Commands for managing encryption keys.
 * @constructor
 */
module.exports = class LogicFunctionsCommand {
	constructor() {
	}

	async list({ org }) {
		const api = createAPI();
		let res;
		try {
			res = await api.getLogicFunctionList({ org });
			const orgName = org ? org : 'Sandbox';
			const list = res.body['logic_functions'];
			if (list.length === 0) {
				console.log(`No Logic Functions currently deployed in your ${orgName}.`);
				console.log(`To create a Logic Function, see \`particle logic-function create\`.\n
							To view Functions from an organization, use the \`--org\` option.\n
							To download an existing Logic Function, see \`particle lf get\`.`);
			} else {
				console.log(`Logic Functions currently deployed in your ${orgName}:\n`);
				list.forEach((item) => {
					// We assume atleast one trigger
					console.log(`  - ${item.name} (${ item.enabled ? chalk.italic('enabled') : chalk.italic('disabled') })\n    - ID: ${item.id}\n    - ${item.logic_triggers[0].type} based trigger`);
				});
				console.log('\n');
				console.log(`To view a Logic Function's code, see \`particle lf get\`.`);
				console.log('\n');
			}
			return res;
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
		}
	}

	async get({ org, name, id }) {
        // TODO
    }

    async create({ org, params: { filepath } }) {
        // TODO
    }

    async execute({ org, data, params: { filepath } }) {
        // TODO
    }

    async deploy({ org, params: { filepath }}) {
        // TODO
    }

    async disable({ org, nane, id }) {
        // TODO
    }

    async delete({ org, name, id }) {
        // TODO
    }

    async logs({ org, name, id, saveTo }) {
        // TODO
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
