const path = require('path');
const fs = require('fs-extra');
const ParticleAPI = require('../cmd/api');
const settings = require('../../settings');
const VError = require('verror');
const { normalizedApiError } = require('./api-client');
const { slugify, globList } = require('./utilities');
const templateProcessor = require('./template-processor');

class LogicFunction {
	constructor({ org, name, id, description, type, enabled, _path, version, triggers, api = createAPI() }) {
		// throw if api is not provided
		this.org = org;
		this.name = name;
		this.description = description || '';
		this.id = id;
		this.api = api;
		this._path = _path || process.cwd();
		this.enabled = !!enabled;
		this.version = version || 0;
		this.triggers = triggers || [];
		this.type = type || 'JavaScript',
		this.files = {
			sourceCode: {
				name: name ? slugify(name) + '.js' : '',
				content: ''
			}, // might change once we implement execute method
			configuration: {
				name: name ? slugify(name) + '.logic.json' : '',
				content: ''
			},
			types:[] // should be an array of { name: 'type name', content: 'type content' }
		};
	}

	static async listFromCloud({ org, api = createAPI() } = {}) {
		try {
			const response = await api.getLogicFunctionList({ org: org });
			const logicFunctions = response.logic_functions.map(logicFunctionData => {
				const lf =  new LogicFunction({
					org,
					...logicFunctionData,
					triggers: logicFunctionData.logic_triggers,
					api
				});
				const source = logicFunctionData.source;
				lf.files.sourceCode.content = source ? source.code : '';
				return lf;

			});
			return logicFunctions;
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
		}
	}

	static async listFromDisk({ filepath, org, api = createAPI() } = {}) {
		if (!filepath) {
			filepath = process.cwd();
		}
		const pathExists = await fs.exists(filepath);
		const logicFunctionExtensionPattern = '*.logic.json';
		const malformedLogicFunctions = [];
		if (!pathExists) {
			throw new Error('Path does not exist');
		}
		// check if the path is a directory or a file
		const stats = await fs.stat(filepath);

		if (stats.isFile()) {
			try {
				// if it is a file, then load it as a logic function
				const lf = await LogicFunction.loadFromDisk({
					basePath: path.dirname(filepath),
					fileName: path.basename(filepath),
					org,
					api
				});
				return [lf];
			} catch (error) {
				malformedLogicFunctions.push({
					fileName: filepath,
					error: error.message
				});
				console.log('Malformed logic functions: ', malformedLogicFunctions);
				return [];
			}
		} else {
			const logicFunctions = [];
			// if it is a directory, then load all the logic functions in the directory
			const files = globList(filepath, [logicFunctionExtensionPattern]);
			if (files.length === 0) {
				return [];
			}
			for (const file of files) {
				// if the file is a directory, then load the logic functions from the directory
				try {
					const lf = await LogicFunction.loadFromDisk({
						basePath: filepath,
						fileName: path.basename(file),
						org,
						api
					});
					logicFunctions.push(lf);
				} catch (error) {
					malformedLogicFunctions.push({
						fileName: file,
						error: error.message
					});
				}
			}
			console.log('Malformed logic functions: ', malformedLogicFunctions);
			return logicFunctions;
		}
	}

	static async loadFromDisk({ basePath, fileName, org, api = createAPI() } = {}) {
		// if receive a .js then look for a .logic.json
		// we need both files to be present
		const baseFileName = fileName.substring(0, fileName.indexOf('.'));
		const codeFile = `${baseFileName}.js`;
		const configFile = `${baseFileName}.logic.json`;
		const files = [codeFile, configFile];
		for (const file of files) {
			const filePath = path.join(basePath, file);
			const pathExists = await fs.exists(filePath);
			if (!pathExists) {
				throw new Error(`File ${file} does not exist`);
			}
		}
		const configuration = await fs.readFile(path.join(basePath, configFile), 'utf8');
		const code = await fs.readFile(path.join(basePath, codeFile), 'utf8');
		const logicFunction = new LogicFunction({ org, api });
		logicFunction.files.configuration.name = configFile;
		logicFunction.files.sourceCode.name = codeFile;
		logicFunction.files.configuration.content = configuration;
		logicFunction.files.sourceCode.content = code;
		logicFunction.path = path;
		logicFunction._deserializeConfiguration();
		return logicFunction;

	}



	// should return an instance of LogicFunction
	static async getByIdOrName({ id, name, list }) {
		const logicFunctionData = list.find(lf => lf.id === id || lf.name === name);
		if (!logicFunctionData) {
			throw new Error('Logic function not found');
		}
		return logicFunctionData;
	}

	async execute(trigger) {
		const logicEvent = {
			event: trigger.event,
			source: {
				type: this.type,
				code: this.files.sourceCode.content
			}
		};
		try {
			const { result } =
				await this.api.executeLogicFunction({ org: this.org, logic: logicEvent });
			return {
				logs: result.logs,
				error: result.err,
				status: result.status,
			};
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error executing logic function' });
		}
	}

	async initFromTemplate({ templatePath }) {
		const contentReplacements = {
			name: this.name,
			description: this.description
		};
		const fileNameReplacements = [
			{ template: 'logic_function_name', fileName: slugify(this.name) },
		];

		const files = await templateProcessor.loadTemplateFiles({
			templatePath,
			contentReplacements,
			fileNameReplacements
		});
		// remove the template path from the file names so that they are relative to the logic function path
		files.forEach(file => {
			file.fileName = file.fileName.replace(templatePath, '');
		});

		// put the data into the logic function
		const sourceCode = files.find(file => file.fileName.includes(this.files.sourceCode.name));
		this.files.sourceCode.name = sourceCode.fileName;
		this.files.sourceCode.content = sourceCode.content;
		const configuration = files.find(file => file.fileName.includes(this.files.configuration.name));
		this.files.configuration.name = configuration.fileName;
		this.files.configuration.content = configuration.content;
		// add types
		this.files.types = files.filter(file => file.fileName.includes('@types')).map(file => {
			return {
				name: file.fileName,
				content: file.content
			};
		});
		this._deserializeConfiguration();
	}

	get configurationPath () {
		return path.join(this._path, this.files.configuration.name);
	}

	get sourcePath () {
		return path.join(this._path, this.files.sourceCode.name);
	}

	set path (value) {
		this._path = value || process.cwd();
	}

	get path () {
		return this._path;
	}

	async saveToDisk(){
		// ensure that the directory exists
		fs.ensureDirSync(this.path);
		// deserialize the logic function to config json
		const configuration = this._toJSONString();
		// save the config json to disk
		await fs.writeFile(this.configurationPath, configuration);
		// save the source code to disk
		await fs.writeFile(this.sourcePath, this.files.sourceCode.content);
		// save the types
		for (const type of this.files.types) {
			const dirPath = path.join(this.path, path.dirname(type.name));
			fs.ensureDirSync(dirPath);
			await fs.writeFile(path.join(dirPath, path.basename(type.name)), type.content);
		}
	}

	_toJSONString(){
		return JSON.stringify({
			logic_function: {
				id: this.id,
				name: this.name,
				description: this.description,
				version: this.version,
				enabled: this.enabled,
				source: {
					type: this.type,
				},
				logic_triggers: this.triggers
			}
		}, null, 2);
	}

	_deserializeConfiguration(){
		const { logic_function: data } = JSON.parse(this.files.configuration.content);
		this.id = data.id;
		this.name = data.name;
		this.description = data.description;
		this.version = data.version;
		this.enabled = data.enabled;
		this.type = data.source.type;
		this.triggers = data.logic_triggers;
	}
}

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

module.exports = LogicFunction;
