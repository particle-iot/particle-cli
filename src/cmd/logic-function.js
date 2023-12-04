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
	}

	async list({ org, display = true }) {
		const api = createAPI();
		try {
			const logicFunctions = await api.getLogicFunctionList({ org });
			const orgName = getOrgName(org);
			const list = logicFunctions.logic_functions;
			if (list.length === 0) {
				if (display) {
					this.ui.stdout.write(`No Logic Functions currently deployed in your ${orgName}.`);
					this.ui.stdout.write(`To create a Logic Function, see \`particle logic-function create\`.${os.EOL}
								To view Functions from an organization, use the \`--org\` option.${os.EOL}
								To download an existing Logic Function, see \`particle lf get\`.${os.EOL}`);
				}
			} else {
				if (display) {
					this.ui.stdout.write(`Logic Functions currently deployed in your ${orgName}:${os.EOL}`);
				}
				list.forEach((item) => {
					// We assume at least one trigger
					if (display) {
						this.ui.stdout.write(`- ${item.name} (${item.enabled ? this.ui.chalk.cyanBright('enabled') : this.ui.chalk.grey('disabled')})${os.EOL}`);
						this.ui.stdout.write(`	- ID: ${item.id}${os.EOL}`);
						this.ui.stdout.write(`	- ${item.logic_triggers[0].type} based trigger ${os.EOL}`);
					}
				});
				if (display) {
					this.ui.stdout.write(`${os.EOL}To view a Logic Function's code, see \`particle lf get.\`${os.EOL}`);
				}
				return list;
			}
			return list;
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
		}
	}

	async get({ org, name, id }) {
		const api = createAPI();
		let list;
		try {
			list = await this.list({ org, display: false });
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
		}

		// TODO: Refactor this!
		if (!name && !id) {
			name = await this._promptForLogicFunctionName(list);
		}
		if (name && !id) {
			id = this._getIdFromName(name, list);
		}
		if (id && !name) {
			name = this._getNameFromId(id, list);
		}
		if (!id) {
			throw new Error('Unable to get logic function id');
		}

		try {
			const logicFunction = await api.getLogicFunction({ org, id });

			// TODO: Address spaces in the name for Windows
			const dirPath = path.join(process.cwd(), `${name}`);
			const jsonPath = path.join(dirPath, `${name}.json`);
			const jsPath = path.join(dirPath, `${name}.js`);
			// TODO: Check if the keys exist?
			const code = logicFunction.logic_function.source.code;
			const logicFunctionJSON = logicFunction.logic_function;
			delete logicFunctionJSON.source;

			if (await this._checkIfDirExists(dirPath)) {
				return;
			}

			await fs.ensureDir(dirPath);
			await fs.writeFile(jsonPath, JSON.stringify(logicFunctionJSON, null, 2));
			await fs.writeFile(jsPath, code);

			this.ui.stdout.write(`${os.EOL}`);
			this.ui.stdout.write(`Downloaded:${os.EOL}`);
			this.ui.stdout.write(` - ${path.basename(dirPath) + '/' + path.basename(jsonPath)}${os.EOL}`);
			this.ui.stdout.write(` - ${path.basename(dirPath) + '/' + path.basename(jsPath)}${os.EOL}`);
			this.ui.stdout.write(`${os.EOL}`);

			this.ui.stdout.write(`Note that any local modifications to these files need to be deployed to the cloud in order to take effect.${os.EOL}` +
				'Refer to \'' +
				this.ui.chalk.yellow('particle logic-function execute') +
				'\' and \'' +
				this.ui.chalk.yellow('particle logic-function deploy') +
				`' for more information.${os.EOL}`);
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error getting logic function' });
		}
	}

	async _checkIfDirExists(dirPath) {
		if (await fs.pathExists(dirPath)) {
			const question = {
				type: 'confirm',
				name: 'overwrite',
				message: `Directory ${path.basename(dirPath)} already exists. Overwrite?`,
				default: false
			};
			const ans = await this.ui.prompt([question]);
			if (!ans.overwrite) {
				return true;
			}
		}
		return false;
	}

	async _promptForLogicFunctionName(list) {
		// XXX: What if list is empty?
		const question = {
			type: 'list',
			name: 'logic_function',
			message: 'Which logic function would you like to download?',
			choices() {
				return list;
			}
		};
		const nonInteractiveError = 'Provide name for the logic function'; // XXX: How to test this?
		const ans = await this.ui.prompt([question], { nonInteractiveError });
		return ans.logic_function;
	}

	_getIdFromName(name, list) {
		const found = list.find(item => item.name === name);
		return found ? found.id : null;
	}

	_getNameFromId(id, list) {
		const found = list.find(item => item.id === id);
		return found ? found.name : null;
	}

	async create({ org, name, params : { filepath } } = { params: { } }) {
		const orgName = getOrgName(org);
		const api = createAPI();
		// get name from filepath
		const logicPath = getFilePath(filepath);
		if (!name) {
			const question = {
				type: 'input',
				name: 'name',
				message: 'What would you like to call your Function?'
			};
			const result =  await this.ui.prompt([question]);
			name = result.name;
		}
		// trim name
		name = name.trim();
		// ask for description
		const question = {
			type: 'input',
			name: 'description',
			message: 'Add a description for your Function (optional)'
		};
		const result =  await this.ui.prompt([question]);
		const description = result.description;
		const slugName = slugify(name);
		const destinationPath = path.join(logicPath, slugName);

		this.ui.stdout.write(`Creating Logic Function ${this.ui.chalk.bold(name)} for ${orgName}...${os.EOL}`);
		await this._validateExistingName({ api, org, name });
		await this._validateExistingFiles({ templatePath: logicFunctionTemplatePath, destinationPath });
		const createdFiles = await this._copyAndReplaceLogicFunction({
			logicFunctionName: name,
			logicFunctionSlugName: slugName,
			description,
			templatePath: logicFunctionTemplatePath,
			destinationPath: path.join(filepath, slugName)
		});
		this.ui.stdout.write(`Successfully created ${this.ui.chalk.bold(name)} in ${this.ui.chalk.bold(logicPath)}${os.EOL}`);
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

	// TODO: Rename this function
	async _validateExistingName({ org, name }) {
		// TODO (hmontero): request for a getLogicFunctionByName() method in the API
		let existingLogicFunction;
		try {
			const list = await this.list({ org, display: false });
			const existingLogicFunctions = list.logic_functions;
			existingLogicFunction = existingLogicFunctions.find((item) => item.name === name);
		} catch (error) {
			this.ui.stdout.write(this.ui.chalk.yellow(`Warn: We were unable to check if a Logic Function with name ${name} already exists.${os.EOL}`));
		}
		if (existingLogicFunction) {
			throw new Error(`Error: Logic Function with name ${name} already exists.`);
		}
	}

	async _validateExistingFiles({ templatePath, destinationPath }){
		const filesAlreadyExist = await templateProcessor.hasTemplateFiles({
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

		const files = await fs.readdir(logicPath);
		const { content: configurationFileString } = await this._pickLogicFunctionFileByExtension({ files, extension: 'json', logicPath });
		const configurationFile = JSON.parse(configurationFileString);
		// TODO (hmontero): here we can pick different files based on the source type
		const { fileName: logicCodeFileName, content: logicCodeContent } = await this._pickLogicFunctionFileByExtension({ files, logicPath });

		const logic = {
			event: {
				event_data: logicData,
				event_name: 'test_event',
				device_id: '',
				product_id: 0
			},
			source: {
				type: configurationFile.logic_function.source.type,
				code: logicCodeContent
			}
		};
		const api = createAPI();
		try {
			this.ui.stdout.write(`Executing Logic Function ${this.ui.chalk.bold(logicCodeFileName)} for ${orgName}...${os.EOL}`);
			const { result } = await api.executeLogicFunction({ org, logic, data });
			const resultType = result.status === 'Success' ? this.ui.chalk.cyanBright(result.status) : this.ui.chalk.red(result.status);
			this.ui.stdout.write(`Execution Status: ${resultType}${os.EOL}`);
			this.ui.stdout.write(`Logs of the Execution:${os.EOL}`);
			result.logs.forEach((log, index) => {
				this.ui.stdout.write(`	${index + 1}.- ${JSON.stringify(log)}${os.EOL}`);
			});
			if (result.err) {
				this.ui.stdout.write(this.ui.chalk.red(`Error during Execution:${os.EOL}`));
				this.ui.stdout.write(`${result.err}${os.EOL}`);
			} else {
				this.ui.stdout.write(this.ui.chalk.cyanBright(`No errors during Execution.${os.EOL}`));
			}
		} catch (error) {
			throw createAPIErrorResult({ error: error, message: `Error executing logic function for ${orgName}` });
		}
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
			const question = {
				type: 'list',
				name: 'file',
				message: `Which ${extension} file would you like to use?`,
				choices
			};
			const result = await this.ui.prompt([question]);
			fileName = result.file;
		}

		const fileBuffer =  await fs.readFile(path.join(logicPath, fileName));
		return { fileName, content: fileBuffer.toString() };
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