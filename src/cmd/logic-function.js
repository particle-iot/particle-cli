const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const ParticleAPI = require('./api');
const settings = require('../../settings');
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
		const logicFunctions = await this._getLogicFunctionListWithSpinner();
		if (!logicFunctions.length) {
			this._printListHelperOutput();
		} else {
			this._printListOutput({ logicFunctionsList: logicFunctions });
		}
	}

	_getLogicFunctionListWithSpinner() {
		return this.ui.showBusySpinnerUntilResolved(
			`Fetching Logic Functions for ${getOrgName(this.org)}...`
			,LogicFunction.listFromCloud({ org: this.org, api: this.api }));
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
		const logicFunctions = await this._getLogicFunctionListWithSpinner();
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
	}

	_printCreateHelperOutput() {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Guidelines for creating your Logic Function can be found here https://docs.particle.io/getting-started/cloud/logic/${os.EOL}`);
		this.ui.stdout.write(`Once you have written your Logic Function, run${os.EOL}`);
		this.ui.stdout.write('- ' + this.ui.chalk.yellow('particle logic-function execute') + ` to run your Function${os.EOL}`);
		this.ui.stdout.write('- ' + this.ui.chalk.yellow('particle logic-function deploy') + ` to deploy your new changes${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
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

		const { status, logs, error } = await this._executeLogicFunctionWithSpinner(logicFunction, eventData);
		this._printExecuteOutput({ logs, error, status });
	}

	async _executeLogicFunctionWithSpinner(logicFunction, eventData) {
		return this.ui.showBusySpinnerUntilResolved(
			`Executing Logic Function ${this.ui.chalk.bold(logicFunction.name)} for ${getOrgName(this.org)}...`
			,logicFunction.execute(eventData));
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
			message: 'Which Logic Function would you like to execute?',
			choices : logicFunctions,
		});

		const logicFunction = logicFunctions.find(lf => lf.name === answer.logicFunction);
		logicFunction.path = filepath;
		return logicFunction;
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
			this.ui.stdout.write(`No errors during Execution.${os.EOL}`);
		} else {
			this.ui.stdout.write(this.ui.chalk.red(`Execution Status: ${status}${os.EOL}`));
			this.ui.stdout.write(this.ui.chalk.red(`Error during Execution:${os.EOL}`));
			this.ui.stdout.write(`${error}${os.EOL}`);
		}
	}

	async deploy({ org, name, id, product_id: productId, event_name: eventName, device_id: deviceId, data, payload, force, params: { filepath } }) {
		this._setOrg(org);
		const logicFunction = await this._pickLogicFunctionFromDisk({ filepath, name, id });
		const eventData = await this._getExecuteData({
			productId,
			deviceId,
			data,
			eventName,
			payload
		});
		const cloudLogicFunctions = await this._getLogicFunctionListWithSpinner();
		const cloudLogicFunction = cloudLogicFunctions.find(lf => lf.name === logicFunction.name);
		await this._confirmDeploy(logicFunction, force);
		if (cloudLogicFunction) {
			await this._promptOverwriteCloudLogicFunction(cloudLogicFunction, force);
			logicFunction.id = cloudLogicFunction.id;
		}
		const { status, logs, error } = await this._executeLogicFunctionWithSpinner(logicFunction, eventData);
		this._printExecuteOutput({ logs, error, status });
		if (status !== 'Success') {
			throw new Error('Unable to deploy Logic Function');
		}
		// TODO (hmontero): put an spinner
		await this._deployLogicFunctionWithSpinner(logicFunction);
		await logicFunction.saveToDisk();
		this._printDeployOutput(logicFunction);
	}

	async _deployLogicFunctionWithSpinner(logicFunction) {
		const logicFunctionShowName = logicFunction.id ? `${logicFunction.name}(${logicFunction.id})` : logicFunction.name;
		return this.ui.showBusySpinnerUntilResolved(
			`Deploying Logic Function ${this.ui.chalk.bold(logicFunctionShowName)} for ${getOrgName(this.org)}...`
			,logicFunction.deploy());
	}

	async _confirmDeploy(logicFunction, force) {
		const logicFunctionShowName = logicFunction.id ? `${logicFunction.name}(${logicFunction.id})` : logicFunction.name;
		if (!force) {
			const confirm = await this._prompt({
				type: 'confirm',
				name: 'proceed',
				message: `Deploying ${logicFunctionShowName} to ${getOrgName(this.org)}. Proceed?`,
				choices: Boolean
			});

			if (!confirm.proceed) {
				this.ui.stdout.write(`Aborted.${os.EOL}`);
				return;
			}
		}
	}
	async _promptOverwriteCloudLogicFunction(cloudLogicFunction, force) {
		if (!force) {
			const confirm = await this._prompt({
				type: 'confirm',
				name: 'proceed',
				message: `A Logic Function with name ${cloudLogicFunction.name} is already available in the cloud ${getOrgName(this.org)}.${os.EOL}Proceed and overwrite with the new content?`,
				choices: Boolean
			});

			if (!confirm.proceed) {
				this.ui.stdout.write(`Aborted.${os.EOL}`);
				process.exit(0);
			}
		}
	}

	_printDeployOutput(logicFunction) {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`${this.ui.chalk.cyanBright('Success!')}${os.EOL}`);
		this.ui.stdout.write(`Logic Function ${this.ui.chalk.cyanBright(logicFunction.name)}(${this.ui.chalk.cyanBright(logicFunction.id)}) deployed to ${getOrgName(this.org)}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Visit ${this.ui.chalk.yellow('console.particle.io')} to view results from your device(s)!${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	async updateStatus({ org, name, id, force, params: { filepath } }, { enable }) {
		this._setOrg(org);
		const cloudLogicFunctions = await this._getLogicFunctionListWithSpinner();
		if (!name && !id) {
			const action = enable ? 'enable' : 'disable';
			name = await this._selectLogicFunctionName(cloudLogicFunctions, action);
		}
		const logicFunction = await LogicFunction.getByIdOrName({ org, id, name, list: cloudLogicFunctions });
		logicFunction.enabled = enable;
		await this._updateLogicFunctionWithSpinner(logicFunction, { enable });
		this._printUpdateStatusOutput({ name: logicFunction.name, id: logicFunction.id , enable });
		const { logicFunctions: localLogicFunctions } = await LogicFunction.listFromDisk({ filepath, org, api: this.api });
		const localLogicFunction = localLogicFunctions.find(lf => lf.name === logicFunction.name);
		if (localLogicFunction) {
			await this._confirmOverwriteIfNeeded({
				filePaths: [localLogicFunction.configurationPath, localLogicFunction.sourcePath],
				force
			});
			// assign cloud values to local Logic Function
			localLogicFunction.copyFromOtherLogicFunction(logicFunction);
			await localLogicFunction.saveToDisk();
			this._printUpdateLocalFilesOutput({
				jsonPath: localLogicFunction.configurationPath,
				jsPath: localLogicFunction.sourcePath,
				enable
			});
		}
	}

	_updateLogicFunctionWithSpinner(logicFunction, { enable }) {
		return this.ui.showBusySpinnerUntilResolved(
			`${enable ? 'Enabling' : 'Disabling'} Logic Function ${this.ui.chalk.bold(logicFunction.name)} for ${getOrgName(this.org)}...`
			,logicFunction.deploy());
	}

	_printUpdateStatusOutput({ name, id, enable }) {
		this.ui.stdout.write(`Logic Function ${name} (${id}) is now ${enable ? 'enabled' : 'disabled'}.${os.EOL}`);
	}

	_printUpdateLocalFilesOutput({ jsonPath, jsPath, enable }) {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`The following files were overwritten after ${enable ? 'enabling': 'disabling'} the Logic Function:${os.EOL}`);
		this.ui.stdout.write(` - ${path.basename(jsonPath)}${os.EOL}`);
		this.ui.stdout.write(` - ${path.basename(jsPath)}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	async delete({ org, name, id, force }) {
		this._setOrg(org);

		const cloudLogicFunctions = await this._getLogicFunctionListWithSpinner();

		if (!name && !id) {
			const action = 'delete';
			name = await this._selectLogicFunctionName(cloudLogicFunctions, action);
		}
		const logicFunction = await LogicFunction.getByIdOrName({ org, id, name, list: cloudLogicFunctions });

		if (!force) {
			const confirm = await this._prompt({
				type: 'confirm',
				name: 'delete',
				message: `Are you sure you want to delete Logic Function ${logicFunction.name}? This action cannot be undone.`,
				choices: Boolean
			});
			if (!confirm.delete) {
				this.ui.stdout.write(`Aborted.${os.EOL}`);
				return;
			}
		}
		await this._deleteLogicFunctionWithSpinner(logicFunction);
		this._printDeleteOutput({ name: logicFunction.name, id: logicFunction.id });
	}

	async _deleteLogicFunctionWithSpinner(logicFunction) {
		return this.ui.showBusySpinnerUntilResolved(
			`Deleting Logic Function ${this.ui.chalk.bold(logicFunction.name)} for ${getOrgName(this.org)}...`
			,logicFunction.deleteFromCloud());
	}

	async _printDeleteOutput({ name, id }) {
		this.ui.stdout.write(`Logic Function ${name}(${id}) has been successfully deleted.${os.EOL}`);
	}

	async logs() {
		// TODO
		this.ui.stdout.write(`Please visit ${this.ui.chalk.yellow('console.particle.io')} to view logs.${os.EOL}`);
	}

	_setOrg(org) {
		if (this.org === null) {
			this.org = org;
		}
	}

	_serializeLogicFunction(data) {
		const logicFunctionCode = data.logic_function.source.code;
		const logicFunctionConfigData = data.logic_function;
		delete logicFunctionConfigData.source.code;

		return { logicFunctionConfigData: { 'logic_function': logicFunctionConfigData }, logicFunctionCode };
	}

	async _selectLogicFunctionName(list, action = 'download') {
		if (list.length === 0) {
			this._printListHelperOutput();
			throw new Error('No Logic Functions found');
		}
		const answer = await this._prompt({
			type: 'list',
			name: 'logic_function',
			message: `Which Logic Function would you like to ${action}?`,
			choices : list,
			nonInteractiveError: 'Provide name for the Logic Function'
		});
		return answer.logic_function;
	}
};

// UTILS //////////////////////////////////////////////////////////////////////
function createAPI() {
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}

// get org name from org slug
function getOrgName(org) {
	return org || 'your Sandbox';
}

module.exports.createAPI = createAPI;
