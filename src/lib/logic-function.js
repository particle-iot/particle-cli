const path = require('path');
const fs = require('fs-extra');
const ParticleAPI = require('../cmd/api');
const settings = require('../../settings');
const VError = require('verror');
const { normalizedApiError } = require('./api-client');
const { slugify } = require('./utilities');
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

	// should return an instance of LogicFunction
	static async getByIdOrName({ id, name, list }) {
		const logicFunctionData = list.find(lf => lf.id === id || lf.name === name);
		if (!logicFunctionData) {
			throw new Error('Logic function not found');
		}
		return logicFunctionData;
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
