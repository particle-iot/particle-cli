const os = require('os');
const path = require('path');
const ParticleAPI = require('./api');
const CLICommandBase = require('./base');
const VError = require('verror');
const settings = require('../../settings');
const { normalizedApiError } = require('../lib/api-client');
const { copyAndReplaceTemplate, hasTemplateFiles } = require('../lib/template-processor');

const logicFunctionTemplatePath = __dirname + '/../../assets/logicFunction';

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
			const list = logicFunctions.logic_functions;
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
			return list;
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
		}
	}


	async get({ org, name, id }) {
		// TODO
		console.log(org, name, id);
	}

	async create({ org, name, params : { filepath } } = { params: { } }) {
		const orgName = getOrgName(org);
		const api = createAPI();
		// get name from filepath
		if (!filepath) {
			// use default directory
			filepath = '.';
		}
		if (!name) {
			const question = {
				type: 'input',
				name: 'name',
				message: 'What would you like to call your Function?'
			};
			const result =  await this.ui.prompt([question]);
			name = result.name;
		}
		// ask for description
		const question = {
			type: 'input',
			name: 'description',
			message: 'Add a description for your Function (optional)'
		};
		const result =  await this.ui.prompt([question]);
		const description = result.description;
		const slugName = name.toLowerCase().replace(/\s/g, '-');
		const destinationPath = path.join(filepath, slugName);

		this.ui.stdout.write(`Creating Logic Function ${this.ui.chalk.bold(name)} for ${orgName}...${os.EOL}`);
		await this._validateExistingName({ api, org, name });
		await this._validateExistingFiles({ templatePath: logicFunctionTemplatePath, destinationPath });

		const createdFiles = await copyAndReplaceTemplate({
			templatePath: logicFunctionTemplatePath,
			destinationPath: path.join(filepath, slugName),
			replacements: {
				name: name,
				description: description || ''
			}
		});
		this.ui.stdout.write(`Successfully created ${this.ui.chalk.bold(name)} in ${this.ui.chalk.bold(filepath)}${os.EOL}`);
		this.ui.stdout.write(`Files created:${os.EOL}`);
		createdFiles.forEach((file) => {
			this.ui.stdout.write(`- ${file}${os.EOL}`);
		});
		this.ui.stdout.write(`${os.EOL}Guidelines for creating your Logic Function can be found <TBD>.${os.EOL}`);
		this.ui.stdout.write(`Once you have written your Logic Function, run${os.EOL}`);
		this.ui.stdout.write(`- \`particle logic execute\` to run your Function${os.EOL}`);
		this.ui.stdout.write(`- \`particle logic deploy\` to deploy your new changes${os.EOL}`);
		return createdFiles;
	}

	async _validateExistingName({ api, org, name }) {
		// TODO (hmontero): request for a getLogicFunctionByName() method in the API
		let existingLogicFunction;
		try {
			const logicFunctionsResponse = await api.getLogicFunctionList({ org });
			const existingLogicFunctions = logicFunctionsResponse.logic_functions;
			existingLogicFunction = existingLogicFunctions.find((item) => item.name === name);
		} catch (error) {
			this.ui.stdout.write(this.ui.chalk.yellow(`Warn: We were unable to check if a Logic Function with name ${name} already exists.${os.EOL}`));
		}
		if (existingLogicFunction) {
			throw new Error(`Error: Logic Function with name ${name} already exists.`);
		}
	}

	async _validateExistingFiles({ templatePath, destinationPath }){
		const filesAlreadyExist = await hasTemplateFiles({
			templatePath,
			destinationPath
		});
		if (filesAlreadyExist) {
			const question = {
				type: 'confirm',
				name: 'overwrite',
				message: `We found existing files in ${this.ui.chalk.bold(destinationPath)}. Would you like to overwrite them?`
			};
			const { overwrite } =  await this.ui.prompt([question]);
			if (!overwrite) {
				this.ui.stdout.write(`Aborted.${os.EOL}`);
				process.exit(0);
			}
		}
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
	return org || 'Sandbox';
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
