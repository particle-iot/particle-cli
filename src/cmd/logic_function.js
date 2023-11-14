const ParticleAPI = require('./api');
const VError = require('verror');
const settings = require('../../settings');
const { normalizedApiError } = require('../lib/api-client');
const UI = require('../lib/ui');
const chalk = require('chalk');
const fs = require('fs-extra');

/**
 * Commands for managing encryption keys.
 * @constructor
 */
module.exports = class LogicFunctionsCommand {
	constructor() {
		this.ui = new UI({ stdin: process.stdin, stdout: process.stdout, stderr: process.stderr, quiet: false });
	}

	async list({ org }, displayText = true) {
		const api = createAPI();
		let res;
		try {
			res = await api.getLogicFunctionList({ org });
			const orgName = org ? org : 'Sandbox';
			const list = res.body['logic_functions'];
			if (list.length === 0) {
				if (displayText) {
					console.log(`No Logic Functions currently deployed in your ${orgName}.`);
					console.log(`To create a Logic Function, see \`particle logic-function create\`.\n
								To view Functions from an organization, use the \`--org\` option.\n
								To download an existing Logic Function, see \`particle lf get\`.`);
				}
			} else {
				if (displayText) {
					console.log(`Logic Functions currently deployed in your ${orgName}:\n`);
				}
				list.forEach((item) => {
					// We assume atleast one trigger
					if (displayText) {
						console.log(`  - ${item.name} (${item.enabled ? chalk.italic('enabled') : chalk.italic('disabled')})\n    - ID: ${item.id}\n    - ${item.logic_triggers[0].type} based trigger`);
					}
				});
				if (displayText) {
					console.log('\n');
					console.log(`To view a Logic Function's code, see \`particle lf get\`.`);
					console.log('\n');
				}
			}
			// returns the array of logic functions
			return res.body['logic_functions'];
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
		}
	}

	async get({ org, name, id }) {
		// Get the logic function id
		const logicFunctionList = await this.list({ org }, false);
		const names = logicFunctionList.map((item) => {
			return {
				name: item.name,
				value: item.id
			};
		});

		if (!name && !id) {
			const question = {
				type: 'list',
				name: 'id',
				message: 'Which logic function would you like to download?',
				choices() {
					return names;
				}
			};
			const nonInteractiveError = 'Unable to retrieve logic functions.';
			const ans = await this.ui.prompt([question], { nonInteractiveError });
			id = ans['id'];
			const nameObj = names.find((item) => {
				return item.value === id;
			});
			name = nameObj.name;
		} else {
			if (name) {
				const logicFunction = logicFunctionList.find((item) => {
					return item.name === name;
				});
				id = logicFunction.id;
			}
		}

		try {
			await fs.mkdir(name);
		} catch (e) {
			if (e.code === 'EEXIST') {
				const question = {
					type: 'confirm',
					name: 'overwrite',
					message: `The folder ${name} already exists. Would you like to overwrite it?`,
					default: false
				};
				const ans = await this.ui.prompt([question]);
				if (!ans['overwrite']) {
					console.log('Aborting download.');
					return;
				}
			} else {
				throw e;
			}
		}

		// download the logic function into the folder
		const api = createAPI();
		try {
			const res = await api.getLogicFunction({ org, id });

			const logicJson = res.body;
			const logicCodeString = logicJson.logic_function.source.code;
			delete logicJson.logic_function.source.code;

			const logicJsonFilepath = `${name}/${name}.logic.json`;
			const logicCodeFilepath = `${name}/${name}.js`;
			try {
				await fs.writeFile(logicJsonFilepath, JSON.stringify(logicJson, null, 4));
				await fs.writeFile(logicCodeFilepath, logicCodeString);
			} catch (e) {
				throw new VError(e, `Error writing to ${name}`);
			}
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error downloading logic function' });
		}

		console.log(`Logic Function ${name} (${id}) downloaded to ${name}/\n`);
		console.log(`Note that any local modifications to these files need to be deployed to the cloud in order to take effect.\nRefer to \`particle logic-function execute\` and \`particle logic-function deploy\` for further details.`);

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

    async disable({ org, name, id }) {
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
