const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const ParticleAPI = require('./api');
const VError = require('verror');
const settings = require('../../settings');
const { normalizedApiError } = require('../lib/api-client');
const templateProcessor = require('../lib/template-processor');
const { slugify } = require('../lib/utilities');

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

		await this._getLogicFunctionList();

		if (this.logicFuncList === null || this.logicFuncList.length === 0) {
			this._printListHelperOutput();
		} else {
			this._printListOutput({ logicFunctionsList: this.logicFuncList });
		}
	}

	_printListHelperOutput() {
		this.ui.stdout.write(`No Logic Functions deployed in your ${getOrgName(this.org)}.${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`To create a Logic Function, see ${this.ui.chalk.yellow('particle logic-function create')}.${os.EOL}`);
		this.ui.stdout.write(`To download an existing Logic Function, see ${this.ui.chalk.yellow('particle logic-function get')}.${os.EOL}`);
	}

	_printListOutput({ logicFunctionsList }) {
		this.ui.stdout.write(`Logic Functions deployed in your ${getOrgName(this.org)}:${os.EOL}`);
		logicFunctionsList.forEach((item) => {
			// We assume at least one trigger
			this.ui.stdout.write(`- ${item.name} (${item.enabled ? this.ui.chalk.cyanBright('enabled') : this.ui.chalk.cyan('disabled')})${os.EOL}`);
			this.ui.stdout.write(`	- ID: ${item.id}${os.EOL}`);
			this.ui.stdout.write(`	- ${item.logic_triggers[0].type} based trigger ${os.EOL}`);
		});
		this.ui.stdout.write(`${os.EOL}To view a Logic Function's code, see ${this.ui.chalk.yellow('particle logic-function get')}.${os.EOL}`);
	}

	async get({ org, name, id }) {
		this._setOrg(org);

		await this._getLogicFunctionList();

		({ name, id } = await this._getLogicFunctionIdAndName(name, id));

		const logicFunctionData = await this._getLogicFunctionData(id);

		const { logicFunctionConfigData, logicFunctionCode } = this._serializeLogicFunction(logicFunctionData);

		const { jsonPath, jsPath } = await this._generateFiles({ logicFunctionConfigData, logicFunctionCode, name });

		this._printGetOutput({ jsonPath, jsPath });
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

	async create({ org, name, params : { filepath } } = { params: { } }) {

		this._setOrg(org);

		await this._getLogicFunctionList();

		// get name from filepath
		const logicFuncPath = getFilePath(filepath);
		if (!name) {
			const result = await this._prompt({
				type: 'input',
				name: 'name',
				message: 'What would you like to call your Function?'
			});
			name = result.name;
		}
		name = name.trim();
		// ask for description
		const result = await this._prompt({
			type: 'input',
			name: 'description',
			message: 'Please provide a short description of your Function:'
		});
		const description = result.description;
		const slugName = slugify(name);
		const destinationPath = path.join(logicFuncPath, slugName);

		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Creating Logic Function ${this.ui.chalk.bold.cyan(name)} for ${getOrgName(this.org)}...${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
		const logicFuncNameDeployed = await this._validateLFName({ name });
		if (logicFuncNameDeployed) {
			throw new Error(`Logic Function ${name} already exists in ${getOrgName(this.org)}. Use a new name for your Logic Function.`);
		}
		await this._validateTemplateFiles({ templatePath: logicFunctionTemplatePath, destinationPath });
		const createdFiles = await this._copyAndReplaceLogicFunction({
			logicFunctionName: name,
			logicFunctionSlugName: slugName,
			description,
			templatePath: logicFunctionTemplatePath,
			destinationPath: path.join(logicFuncPath, slugName)
		});
		this.ui.stdout.write(`Successfully created ${this.ui.chalk.bold.cyan(name)} locally in ${this.ui.chalk.bold(logicFuncPath)}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Files created:${os.EOL}`);
		createdFiles.forEach((file) => {
			this.ui.stdout.write(`- ${file}${os.EOL}`);
		});
		this.ui.stdout.write(`${os.EOL}Guidelines for creating your Logic Function can be found here <TBD>.${os.EOL}`);
		this.ui.stdout.write(`Once you have written your Logic Function, run${os.EOL}`);
		this.ui.stdout.write('- ' + this.ui.chalk.yellow('\'particle logic-function execute\'') + ` to run your Function${os.EOL}`);
		this.ui.stdout.write('- ' + this.ui.chalk.yellow('\'particle logic-function deploy\'') + ` to deploy your new changes${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
		return createdFiles;
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

	// Prompts the user to overwrite if any files exist
	// If user says no, we exit the process
	async _validatePaths({ jsonPath, jsPath, _exit = () => process.exit(0) }) {
		let exists = false;
		const pathsToCheck = [jsonPath, jsPath];
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

	// Prompts the user to overwrite if any files exist
	// If user says no, we exit the process
	async _validateTemplateFiles({ templatePath, destinationPath }) {
		const filesExist = await templateProcessor.hasTemplateFiles({
			templatePath,
			destinationPath
		});
		if (filesExist) {
			const overwrite = await this._promptOverwrite({
				pathToCheck: destinationPath,
				message: `We found existing files in ${this.ui.chalk.bold(destinationPath)}. Would you like to overwrite them?`
			});
			if (!overwrite) {
				this.ui.stdout.write(`Aborted.${os.EOL}`);
				process.exit(0);
			}
		}
	}

	/** Recursively copy and replace template files */
	async _copyAndReplaceLogicFunction({ logicFunctionName, logicFunctionSlugName, description, templatePath, destinationPath }){
		const files = await fs.readdir(templatePath);
		const createdFiles = [];

		for (const file of files){
			//createdFiles.push(destinationFile);
			// check if file is a dir
			const stat = await fs.stat(path.join(templatePath, file));
			if (stat.isDirectory()) {
				const subFiles = await this._copyAndReplaceLogicFunction({
					logicFunctionName,
					logicFunctionSlugName,
					description,
					templatePath: path.join(templatePath, file),
					destinationPath: path.join(destinationPath, file)
				});
				createdFiles.push(...subFiles);
			} else {
				const fileReplacements = {
					'logic_function_name': logicFunctionSlugName,
				};
				const destinationFile = await templateProcessor.copyAndReplaceTemplate({
					fileNameReplacements: fileReplacements,
					file,
					templatePath,
					destinationPath,
					replacements: {
						name: logicFunctionName,
						description: description || ''
					}
				});
				createdFiles.push(destinationFile);
			}
		}
		// return file name created
		return createdFiles;
	}

	async execute({ org, data, dataPath, params: { filepath } }) {
		let logicData;
		const orgName = getOrgName(org);
		const logicPath = getFilePath(filepath);

		if (!data && !dataPath) {
			throw new Error('Error: Please provide either data or dataPath');
		}
		if (data && dataPath) {
			throw new Error('Error: Please provide either data or dataPath');
		}
		if (dataPath) {
			logicData = await fs.readFile(dataPath, 'utf8');
		} else {
			logicData = data;
		}

		const { logicConfigContent } = await this._getLogicFunctionConfig({ logicPath });
		const { logicCodeFileName, logicCodeContent } = await this._getLogicFunctionCode({ logicPath });

		const logic = {
			event: {
				event_data: logicData,
				event_name: 'test_event',
				device_id: '',
				product_id: 0
			},
			source: {
				type: logicConfigContent.logic_function.source.type,
				code: logicCodeContent
			}
		};
		const api = createAPI();
		try {
			this.ui.stdout.write(`Executing Logic Function ${this.ui.chalk.bold(logicCodeFileName)} for ${orgName}...${os.EOL}`);
			this.ui.stdout.write(`${os.EOL}`);
			const { result } = await api.executeLogicFunction({ org, logic, data });
			const resultType = result.status === 'Success' ? this.ui.chalk.cyanBright(result.status) : this.ui.chalk.red(result.status);
			this.ui.stdout.write(`Execution Status: ${resultType}${os.EOL}`);
			if (result.logs.length === 0) {
				this.ui.stdout.write(`No logs obtained from Execution${os.EOL}`);
				this.ui.stdout.write(`${os.EOL}`);
			} else {
				this.ui.stdout.write(`Logs from Execution:${os.EOL}`);
				result.logs.forEach((log, index) => {
					this.ui.stdout.write(`	${index + 1}.- ${JSON.stringify(log)}${os.EOL}`);
				});
				this.ui.stdout.write(`${os.EOL}`);
			}
			if (result.err) {
				this.ui.stdout.write(this.ui.chalk.red(`Error during Execution:${os.EOL}`));
				this.ui.stdout.write(`${result.err}${os.EOL}`);
				this.ui.stdout.write(`${os.EOL}`);
			} else {
				this.ui.stdout.write(this.ui.chalk.cyanBright(`No errors during Execution.${os.EOL}`));
				this.ui.stdout.write(`${os.EOL}`);
			}
			return { logicConfigContent, logicCodeContent };
		} catch (error) {
			throw createAPIErrorResult({ error: error, message: `Error executing logic function for ${orgName}` });
		}
	}

	async _getLogicFunctionConfig({ logicPath }) {
		const files = await fs.readdir(logicPath);
		const { fileName, content: configurationFileString } = await this._pickLogicFunctionFileByExtension({ files, extension: 'json', logicPath });
		const configurationFileJson = JSON.parse(configurationFileString);
		return { logicConfigFileName: fileName, logicConfigContent: configurationFileJson };
	}
	async _getLogicFunctionCode({ logicPath }) {
		const files = await fs.readdir(logicPath);
		// TODO (hmontero): here we can pick different files based on the source type
		const { fileName: logicCodeFileName, content: logicCodeContent } = await this._pickLogicFunctionFileByExtension({ files, logicPath });
		return { logicCodeFileName, logicCodeContent };
	}

	async _pickLogicFunctionFileByExtension({ logicPath, files, extension = 'js' } ) {
		let fileName;
		const filteredFiles = findFilesByExtension(files, extension);
		if (filteredFiles.length === 0) {
			throw new Error(`Error: No ${extension} files found in ${logicPath}`);
		}
		if (filteredFiles.length === 1) {
			fileName = filteredFiles[0];
		} else {
			const choices = filteredFiles.map((file) => {
				return {
					name: file,
					value: file
				};
			});

			const result = await this._prompt({
				type: 'list',

				name: 'file',
				message: `Which ${extension} file would you like to use?`,
				choices
			});
			fileName = result.file;
		}

		const fileBuffer =  await fs.readFile(path.join(logicPath, fileName));
		return { fileName, content: fileBuffer.toString() };
	}

	async deploy({ org, data, dataPath, params: { filepath } }) {
		this._setOrg(org);

		await this._getLogicFunctionList();

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

		const { logicConfigContent, logicCodeContent } = await this.execute({ org, data, dataPath, params: { filepath } });
		const name = logicConfigContent.logic_function.name;
		logicConfigContent.logic_function.enabled = true;
		logicConfigContent.logic_function.source.code = logicCodeContent;

		const logicFuncNameDeployed = await this._validateLFName({ name });
		if (logicFuncNameDeployed) {
			try {
				const confirm = await this._prompt({
					type: 'confirm',
					name: 'proceed',
					message: `A Logic Function with name ${name} is already available in the cloud ${getOrgName(this.org)}. Proceed and overwrite with the new content?`,
					choices: Boolean
				});

				if (!confirm.proceed) {
					this.ui.stdout.write(`Aborted.${os.EOL}`);
					return;
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
		this.ui.stdout.write(`Deploying Logic Function ${this.ui.chalk.bold.cyanBright(`${name} (${id})`)} to ${getOrgName(this.org)}...${os.EOL}`);
		this.ui.stdout.write(`${this.ui.chalk.cyanBright('Success!')}${os.EOL}`);
		this.ui.stdout.write(`${this.ui.chalk.yellow('Visit \'console.particle.io\' to view results from your device(s)!')}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	async _printDeployNewLFOutput(name, id) {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`Deploying Logic Function ${this.ui.chalk.bold(`${name}`)} to ${getOrgName(this.org)}...${os.EOL}`);
		this.ui.stdout.write(`${this.ui.chalk.cyanBright(`Success! Logic Function ${this.ui.chalk.bold.cyanBright(name)} deployed with ${this.ui.chalk.bold.cyanBright(id)}`)}${os.EOL}`);
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

		const exist = await this._validatePaths({ jsonPath, jsPath });

		if (!exist) {
			return;
		}

		const logicFunctionData = await this._getLogicFunctionData(id);

		const { logicFunctionConfigData, logicFunctionCode } = this._serializeLogicFunction(logicFunctionData);

		const { genJsonPath, genJsPath } = await this._generateFiles({ logicFunctionConfigData, logicFunctionCode, name });

		this._printDisableNewFilesOutput({ jsonPath: genJsonPath, jsPath: genJsPath });
	}

	_printDisableOutput(name, id) {
		this.ui.stdout.write(`Logic Function ${name}(${id}) is now disabled.${os.EOL}`);
	}

	_printEnableOutput(name, id) {
		this.ui.stdout.write(`Logic Function ${name}(${id}) is now enabled.${os.EOL}`);
	}

	_printDisableNewFilesOutput({ jsonPath, jsPath }) {
		this.ui.stdout.write(`${os.EOL}`);
		this.ui.stdout.write(`The following files were overwritten after disabling the Logic Function:${os.EOL}`);
		this.ui.stdout.write(` - ${path.basename(jsonPath)}${os.EOL}`);
		this.ui.stdout.write(` - ${path.basename(jsPath)}${os.EOL}`);
		this.ui.stdout.write(`${os.EOL}`);
	}

	async delete({ org, name, id }) {
		this._setOrg(org);

		await this._getLogicFunctionList();

		({ name, id } = await this._getLogicFunctionIdAndName(name, id));

		const confirm = await this._prompt({
			type: 'confirm',
			name: 'delete',
			message: `Are you sure you want to delete Logic Function ${name}? This action cannot be undone.`,
			choices: Boolean
		});

		if (confirm.delete) {
			try {
				await this.api.deleteLogicFunction({ org: this.org, id });
				this.ui.stdout.write(`Logic Function ${name}(${id}) has been successfully deleted.${os.EOL}`);
			} catch (err) {
				throw new Error(`Error deleting Logic Function ${name}: ${err.message}`);
			}
		} else {
			this.ui.stdout.write(`Aborted.${os.EOL}`);
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

		await this._validatePaths({ jsonPath, jsPath });

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
			name = await this._selectLogicFunction(this.logicFuncList);
			id = this._getIdFromName(name, this.logicFuncList);
		} else if (!id && name) {
			id = this._getIdFromName(name, this.logicFuncList);
		} else if (id && !name) {
			name = this._getNameFromId(id, this.logicFuncList);
		}

		return { name, id };
	}

	async _selectLogicFunction(list) {
		if (list.length === 0) {
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

function getFilePath(filepath) {
	return filepath || '.';
}

function findFilesByExtension(files, extension) {
	return files.filter((file) => file.endsWith(`.${extension}`));
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
