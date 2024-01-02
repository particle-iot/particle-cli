const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const ParticleAPI = require('./api');
const VError = require('verror');
const settings = require('../../settings');
const { normalizedApiError } = require('../lib/api-client');
const { slugify } = require('../lib/utilities');
const LogicFunction = require('../lib/logic-function');

const logicFunctionTemplatePath = path.join(__dirname, '/../../assets/logicFunction');
const CLICommandBase = require('./base');

/**
 * Commands for managing encryption keys.
 * @constructor
 */
module.exports = class LogicFunctionsCommand extends CLICommandBase {
	constructor(...args) {
		super(...args);
		this.api = createAPI();
		this.logicFuncList = null;
		this.org = null;
	}

	async list({ org }) {
		this._setOrg(org);
		const logicFunctions = await LogicFunction.listFromCloud({ org, api: this.api });
		if (!logicFunctions.length) {
			this._printListHelperOutput();
		} else {
			this._printListOutput({ logicFunctionsList: logicFunctions });
		}
	}

	_printListHelperOutput({ fromFile } = {}) {
		if (fromFile) {
			this.ui.stdout.write(`No Logic Functions found in your directory.${os.EOL}`);
		} else {
			this.ui.stdout.write(`No Logic Functions deployed in ${getOrgName(this.org)}.${os.EOL}`);
		}
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`To create a Logic Function, see ${this.ui.chalk.yellow('particle logic-function create')}.${os.EOL}`);
		this.ui.stdout.write(`To download an existing Logic Function, see ${this.ui.chalk.yellow('particle logic-function get')}.${os.EOL}`);
	}

	_printListOutput({ logicFunctionsList }) {
		this.ui.stdout.write(`Logic Functions deployed in ${getOrgName(this.org)}:${os.EOL}`);
		logicFunctionsList.forEach((item) => {
			// We assume at least one trigger
			this.ui.stdout.write(`- ${item.name} (${item.enabled ? this.ui.chalk.cyanBright('enabled') : this.ui.chalk.cyan('disabled')})${os.EOL}`);
			this.ui.stdout.write(`	- ID: ${item.id}${os.EOL}`);
			this.ui.stdout.write(`	- ${item.triggers[0].type} based trigger ${os.EOL}`);
		});
		this.ui.stdout.write(`${os.EOL}To view a Logic Function's code, see ${this.ui.chalk.yellow('particle logic-function get')}.${os.EOL}`);
	}

	async get({ org, name, id, params : { filepath } } = { params: { } }) {
		this._setOrg(org);
		const logicFunctions = await LogicFunction.listFromCloud({ org, api: this.api });
		if (!name && !id) {
			name = await this._selectLogicFunctionName(logicFunctions);
		}
		const logicFunction = await LogicFunction.getByIdOrName({ org, id, name, list: logicFunctions });
		logicFunction.path = filepath;

		// check if the files already exists
		await this._confirmOverwriteIfNeeded({
			filePaths: [logicFunction.configurationPath, logicFunction.sourcePath],
		});
		await logicFunction.saveToDisk();
		this._printGetOutput({
			jsonPath: logicFunction.configurationPath,
			jsPath: logicFunction.sourcePath
		});
		this._printGetHelperOutput();
	}

	_printGetOutput({ jsonPath, jsPath }) {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Downloaded:${os.EOL}`);
		this.ui.stdout.write(` - ${path.basename(jsonPath)}${os.EOL}`);
		this.ui.stdout.write(` - ${path.basename(jsPath)}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	_printGetHelperOutput() {
		this.ui.stdout.write(`Note that any local modifications to these files need to be deployed to the cloud in order to take effect.${os.EOL}` +
			`Refer to ${this.ui.chalk.yellow('particle logic-function execute')} and ${this.ui.chalk.yellow('particle logic-function deploy')} for more information.${os.EOL}`);
	}

	async create({ org, name, description, force, params : { filepath } } = { params: { } }) {
		this._setOrg(org);
		const {
			name: logicFunctionName,
			description: logicFunctionDescription
		}  = await this._promptLogicFunctionInput({ _name: name, _description: description, force });
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Creating Logic Function ${this.ui.chalk.cyan(logicFunctionName)} for ${getOrgName(this.org)}...${os.EOL}`);

		const logicFunction = new LogicFunction({
			org,
			name: logicFunctionName,
			_path: filepath,
			description: logicFunctionDescription,
			api: this.api
		});

		await logicFunction.initFromTemplate({ templatePath: logicFunctionTemplatePath });

		await this._confirmOverwriteIfNeeded({
			filePaths: [logicFunction.configurationPath, logicFunction.sourcePath],
			force
		});

		await logicFunction.saveToDisk();
		// notify files were created
		this._printCreateOutput({
			logicFunctionName,
			basePath: logicFunction.path,
			jsonPath: logicFunction.configurationPath,
			jsPath: logicFunction.sourcePath
		});
		this._printCreateHelperOutput();
	}

	async _promptLogicFunctionInput({ _name, _description, force }) {
		let name = _name, description = _description;
		if (force) {
			return {
				name: name? name.trim() : '',
				description: description ? description.trim() : ''
			};
		}
		if (!_name) {
			const result = await this._prompt({
				type: 'input',
				name: 'name',
				message: 'What would you like to call your Function?'
			});
			if (!result.name) {
				throw new Error('Please provide a name for the Logic Function');
			}
			name = result.name;
		}

		if (!_description) {
			const result = await this._prompt({
				type: 'input',
				name: 'description',
				message: 'Please provide a short description of your Function:'
			});
			description = result.description;
		}

		return {
			name: name.trim(),
			description: description.trim()
		};
	}

	_printCreateOutput({ logicFunctionName, basePath, jsonPath, jsPath }) {
		this.ui.stdout.write(`Successfully created ${this.ui.chalk.cyan(logicFunctionName)} locally in ${this.ui.chalk.bold(basePath)}`);
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Files created:${os.EOL}`);
		this.ui.stdout.write(`- ${path.basename(jsPath)}${os.EOL}`);
		this.ui.stdout.write(`- ${path.basename(jsonPath)}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	_printCreateHelperOutput() {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Guidelines for creating your Logic Function can be found here https://docs.particle.io/getting-started/cloud/logic/${os.EOL}`);
		this.ui.stdout.write(`Once you have written your Logic Function, run${os.EOL}`);
		this.ui.stdout.write('- ' + this.ui.chalk.yellow('\'particle logic-function execute\'') + ` to run your Function${os.EOL}`);
		this.ui.stdout.write('- ' + this.ui.chalk.yellow('\'particle logic-function deploy\'') + ` to deploy your new changes${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	// Returns if name is already deployed
	async _validateLFName({ name }) {
		// TODO (hmontero): request for a getLogicFunctionByName() method in the API
		const logicFuncNameExists = this.logicFuncList.find((item) => item.name === name);
		return Boolean(logicFuncNameExists);
	}

	async _prompt({ type, name, message, choices, nonInteractiveError }) {
		const question = {
			type,
			name,
			message,
			choices
		};
		const result = await this.ui.prompt([question], { nonInteractiveError });
		return result;
	}

	async _promptOverwrite({ message }) {
		const answer = await this._prompt({
			type: 'confirm',
			name: 'overwrite',
			message,
			choices: Boolean
		});
		return answer.overwrite;
	}

	async _confirmOverwriteIfNeeded({ force, filePaths, _exit = () => process.exit(0) }) {
		if (force) {
			return;
		}
		let exists = false;
		const pathsToCheck = filePaths;
		for (const p of pathsToCheck) {
			if (await fs.pathExists(p)) {
				exists = true;
			}
		}

		if (exists) {
			const overwrite = await this._promptOverwrite({
				message: 'This Logic Function was previously downloaded locally. Overwrite?',
			});
			if (!overwrite) {
				this.ui.stdout.write(`Aborted.${os.EOL}`);
				_exit();
			}
		}
		return exists;
	}

	async execute({ org, name, id, product_id: productId, event_name: eventName, device_id: deviceId, data, payload, params: { filepath } }) {
		this._setOrg(org);
		const logicFunction = await this._pickLogicFunctionFromDisk({ filepath, name, id });
		const eventData = await this._getExecuteData({
			productId,
			deviceId,
			data,
			eventName,
			payload
		});
		const { status, logs, error } = await logicFunction.execute(eventData);
		this.ui.stdout.write(`Executing Logic Function ${this.ui.chalk.bold(logicFunction.name)} for ${getOrgName(this.org)}...${os.EOL}`);
		this._printExecuteOutput({ logs, error, status });
	}

	async _pickLogicFunctionFromDisk({ filepath, name, id }) {
		let { logicFunctions, malformedLogicFunctions } = await LogicFunction.listFromDisk({ filepath, api: this.api, org: this.org });
		if (name || id) {
			logicFunctions = logicFunctions.filter(lf => (lf.name === name && name) || (lf.id === id && id));
		}
		if (logicFunctions.length === 0) {
			this._printMalformedLogicFunctionsFromDisk(malformedLogicFunctions);
			this._printListHelperOutput({ fromFile: true });
			throw new Error('No Logic Functions found');
		}
		if (logicFunctions.length && !name && !id) {
			this._printMalformedLogicFunctionsFromDisk(malformedLogicFunctions);
		}
		if (logicFunctions.length === 1) {
			return logicFunctions[0];
		}
		const answer = await this._prompt({
			type: 'list',
			name: 'logicFunction',
			message: 'Which logic function would you like to execute?',
			choices : logicFunctions,
		});

		return logicFunctions.find(lf => lf.name === answer.logicFunction);
	}

	_printMalformedLogicFunctionsFromDisk(malformedLogicFunctions) {
		if (malformedLogicFunctions.length) {
			this.ui.stdout.write(this.ui.chalk.red(`The following Logic Functions are not valid:${os.EOL}`));
			malformedLogicFunctions.forEach((item) => {
				this.ui.stdout.write(`- ${item.name}: ${item.error}${os.EOL}`);
			});
			this.ui.stdout.write(`${os.EOL}`);
		}
	}

	async _getExecuteData({ productId, deviceId, eventName, data, payload }) {
		if (payload) {
			return this._getExecuteDataFromPayload(payload);
		}
		return {
			event:  {
				event_name: eventName || 'test_event',
				product_id: productId || 0,
				device_id: deviceId || '',
				event_data: data || ''
			}
		};
	}

	async _getExecuteDataFromPayload(payload) {
		const parsedAsJson = await this._parseEventFromPayload(payload);
		if (!parsedAsJson.error) {
			return parsedAsJson.eventData;
		}
		const parsedAsFile = await this._parseEventFromFile(payload);
		if (parsedAsFile.error) {
			throw new Error('Unable to parse payload as JSON or file');
		} else {
			return parsedAsFile.eventData;
		}
	}

	async _parseEventFromPayload(payload) {
		let eventData, error;
		try {
			eventData = JSON.parse(payload);
		} catch (_error) {
			error = _error;
		}
		return { error, eventData };
	}

	async _parseEventFromFile(payloadPah) {
		let eventData, error;
		try {
			eventData = await fs.readJson(payloadPah);
		} catch (_error) {
			error = _error;
		}
		return { error, eventData };
	}

	_printExecuteOutput({ logs, error, status }) {
		if (status === 'Success') {
			this.ui.stdout.write(this.ui.chalk.cyanBright(`Execution Status: ${status}${os.EOL}`));
			if (logs.length === 0) {
				this.ui.stdout.write(`No logs obtained from Execution${os.EOL}`);
				this.ui.stdout.write(`${os.EOL}`);
			} else {
				this.ui.stdout.write(`Logs from Execution:${os.EOL}`);
				logs.forEach((log, index) => {
					this.ui.stdout.write(`	${index + 1}.- ${JSON.stringify(log)}${os.EOL}`);
				});
				this.ui.stdout.write(`${os.EOL}`);
			}
		} else {
			this.ui.stdout.write(this.ui.chalk.red(`Execution Status: ${status}${os.EOL}`));
			this.ui.stdout.write(this.ui.chalk.red(`Error during Execution:${os.EOL}`));
			this.ui.stdout.write(`${error}${os.EOL}`);
		}
	}

	async deploy({ org, data, force, dataPath, params: { filepath } }) {
		this._setOrg(org);

		await this._getLogicFunctionList();

		if (!force) {
			const confirm = await this._prompt({
				type: 'confirm',
				name: 'proceed',
				message: `Deploying to ${getOrgName(this.org)}. Proceed?`,
				choices: Boolean
			});

			if (!confirm.proceed) {
				this.ui.stdout.write(`Aborted.${os.EOL}`);
				return;
			}
		}


		const { logicConfigContent, logicCodeContent } = await this.execute({ org, data, dataPath, params: { filepath } });
		const name = logicConfigContent.logic_function.name;
		logicConfigContent.logic_function.enabled = true;
		logicConfigContent.logic_function.source.code = logicCodeContent;

		const logicFuncNameDeployed = await this._validateLFName({ name });
		if (logicFuncNameDeployed) {
			try {
				if (!force) {
					const confirm = await this._prompt({
						type: 'confirm',
						name: 'proceed',
						message: `A Logic Function with name ${name} is already available in the cloud ${getOrgName(this.org)}.${os.EOL}Proceed and overwrite with the new content?`,
						choices: Boolean
					});

					if (!confirm.proceed) {
						this.ui.stdout.write(`Aborted.${os.EOL}`);
						return;
					}
				}
				const { id } = await this._getLogicFunctionIdAndName(name);
				await this.api.updateLogicFunction({ org, id, logicFunctionData: logicConfigContent.logic_function });
				this._printDeployOutput(name, id);
			} catch (err) {
				throw new Error(`Error deploying Logic Function ${name}: ${err.message}`);
			}
		} else {
			try {
				const deployedLogicFunc = await this.api.createLogicFunction({ org, logicFunction: logicConfigContent.logic_function });
				this._printDeployNewLFOutput(deployedLogicFunc.logic_function.name, deployedLogicFunc.logic_function.id);
			} catch (err) {
				throw new Error(`Error deploying Logic Function ${name}: ${err.message}`);
			}
		}
	}

	async _printDeployOutput(name, id) {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Deploying Logic Function ${this.ui.chalk.cyanBright(`${name} (${id})`)} to ${getOrgName(this.org)}...${os.EOL}`);
		this.ui.stdout.write(`${this.ui.chalk.cyanBright('Success!')}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`${this.ui.chalk.yellow('Visit \'console.particle.io\' to view results from your device(s)!')}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	async _printDeployNewLFOutput(name, id) {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Deploying Logic Function ${this.ui.chalk.bold(`${name}`)} to ${getOrgName(this.org)}...${os.EOL}`);
		this.ui.stdout.write(`${this.ui.chalk.cyanBright(`Success! Logic Function ${this.ui.chalk.cyanBright(name)} deployed with ${this.ui.chalk.cyanBright(id)}`)}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`${this.ui.chalk.yellow('Visit \'console.particle.io\' to view results from your device(s)!')}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	async updateStatus({ org, name, id }, { enable }) {
		this._setOrg(org);

		await this._getLogicFunctionList();

		({ name, id } = await this._getLogicFunctionIdAndName(name, id));

		let logicFunctionJson = await this._getLogicFunctionData(id);
		logicFunctionJson.logic_function.enabled = enable;

		try {
			await this.api.updateLogicFunction({ org, id, logicFunctionData: logicFunctionJson.logic_function });
			if (enable) {
				this._printEnableOutput(name, id);
			} else {
				this._printDisableOutput(name, id);
			}
		} catch (err) {
			throw new Error(`Error updating Logic Function ${name}: ${err.message}`);
		}

		// Overwrite logic function if found locally since it is now disabled
		await this._overwriteIfLFExistsLocally(name, id);
	}

	async _overwriteIfLFExistsLocally(name, id) {
		const { jsonPath, jsPath } = this._getLocalLFPathNames(name);

		const exist = await this._confirmOverwriteIfNeeded(
			{ filePaths: [jsonPath, jsPath] });

		if (!exist) {
			return;
		}

		const logicFunctionData = await this._getLogicFunctionData(id);

		const { logicFunctionConfigData, logicFunctionCode } = this._serializeLogicFunction(logicFunctionData);

		const { genJsonPath, genJsPath } = await this._generateFiles({ logicFunctionConfigData, logicFunctionCode, name });

		this._printDisableNewFilesOutput({ jsonPath: genJsonPath, jsPath: genJsPath });
	}

	_printDisableOutput(name, id) {
		this.ui.stdout.write(`Logic Function ${name} (${id}) is now disabled.${os.EOL}`);
	}

	_printEnableOutput(name, id) {
		this.ui.stdout.write(`Logic Function ${name} (${id}) is now enabled.${os.EOL}`);
	}

	_printDisableNewFilesOutput({ jsonPath, jsPath }) {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`The following files were overwritten after disabling the Logic Function:${os.EOL}`);
		this.ui.stdout.write(` - ${path.basename(jsonPath)}${os.EOL}`);
		this.ui.stdout.write(` - ${path.basename(jsPath)}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	async delete({ org, name, id, force }) {
		this._setOrg(org);

		await this._getLogicFunctionList();

		({ name, id } = await this._getLogicFunctionIdAndName(name, id));

		if (!force) {
			const confirm = await this._prompt({
				type: 'confirm',
				name: 'delete',
				message: `Are you sure you want to delete Logic Function ${name}? This action cannot be undone.`,
				choices: Boolean
			});
			if (!confirm.delete) {
				this.ui.stdout.write(`Aborted.${os.EOL}`);
				return;
			}
		}
		try {
			await this.api.deleteLogicFunction({ org: this.org, id });
			this.ui.stdout.write(`Logic Function ${name}(${id}) has been successfully deleted.${os.EOL}`);
		} catch (err) {
			throw new Error(`Error deleting Logic Function ${name}: ${err.message}`);
		}
	}

	async logs({ org, name, id, saveTo }) {
		// TODO
		console.log(org, name, id, saveTo);
	}

	_setOrg(org) {
		if (this.org === null) {
			this.org = org;
		}
	}

	async _getLogicFunctionList() {
		if (this.logicFuncList === null) {
			try {
				const res = await this.api.getLogicFunctionList({ org: this.org });
				this.logicFuncList = res.logic_functions;
			} catch (e) {
				throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
			}
		}
	}

	async _getLogicFunctionData(id) {
		try {
			const logicFunction = await this.api.getLogicFunction({ org: this.org, id });
			return logicFunction;
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error getting logic function' });
		}
	}

	_serializeLogicFunction(data) {
		const logicFunctionCode = data.logic_function.source.code;
		const logicFunctionConfigData = data.logic_function;
		delete logicFunctionConfigData.source.code;

		return { logicFunctionConfigData: { 'logic_function': logicFunctionConfigData }, logicFunctionCode };
	}

	async _generateFiles({ logicFunctionConfigData, logicFunctionCode, name }) {
		const { jsonPath, jsPath } = this._getLocalLFPathNames(name);

		await this._confirmOverwriteIfNeeded({ filePaths: { jsonPath, jsPath } });

		await fs.writeFile(jsonPath, JSON.stringify(logicFunctionConfigData, null, 2));
		await fs.writeFile(jsPath, logicFunctionCode);

		return { jsonPath, jsPath };
	}

	_getLocalLFPathNames(name) {
		const slugName = slugify(name);
		const jsonPath = path.join(process.cwd(), `${slugName}.logic.json`);
		const jsPath = path.join(process.cwd(), `${slugName}.js`);

		return { jsonPath, jsPath };
	}

	async _getLogicFunctionIdAndName(name, id) {
		if (!id && !name) {
			name = await this._selectLogicFunctionName(this.logicFuncList);
			id = this._getIdFromName(name, this.logicFuncList);
		} else if (!id && name) {
			id = this._getIdFromName(name, this.logicFuncList);
		} else if (id && !name) {
			name = this._getNameFromId(id, this.logicFuncList);
		}

		return { name, id };
	}

	async _selectLogicFunctionName(list) {
		if (list.length === 0) {
			this._printListHelperOutput();
			throw new Error('No logic functions found');
		}
		const answer = await this._prompt({
			type: 'list',
			name: 'logic_function',
			message: 'Which logic function would you like to download?',
			choices : list,
			nonInteractiveError: 'Provide name for the logic function'
		});
		return answer.logic_function;
	}

	_getIdFromName(name, list) {
		const found = list.find(item => item.name === name);

		if (!found) {
			throw new Error('Unable to get logic function id from name');
		}

		return found.id;
	}

	_getNameFromId(id, list) {
		const found = list.find(item => item.id === id);

		if (!found) {
			throw new Error('Unable to get logic function name from id');
		}

		return found.name;
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
	return org || 'your Sandbox';
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
