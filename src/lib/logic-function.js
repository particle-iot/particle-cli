const path = require('path');
const fs = require('fs-extra');
const ParticleAPI = require('../cmd/api');
const settings = require('../../settings');
const VError = require('verror');
const { normalizedApiError } = require('./api-client');
const { slugify } = require('./utilities');

class LogicFunction {
	constructor({ org, name, id, description, source, enabled, _path, version, triggers, api = createAPI() }) {
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
		this.source = {
			type: source ? source.type : 'JavaScript',
			code: source ? source.code : ''
		};
		this.fileNames = {
			sourceCode: name ? slugify(name) + '.js' : '', // might change once we implement execute method
			configuration: name ? slugify(name) + '.logic.json' : ''
		};
	}

	static async listFromCloud({ org, api = createAPI() } = {}) {
		try {
			const response = await api.getLogicFunctionList({ org: org });
			const logicFunctions = response.logic_functions.map(logicFunctionData => {
				return new LogicFunction({
					org,
					...logicFunctionData,
					triggers: logicFunctionData.logic_triggers,
					api
				});

			});
			return logicFunctions;
		} catch (e) {
			throw createAPIErrorResult({ error: e, message: 'Error listing logic functions' });
		}
	}

	static async listFromDisk({ path }) {
		// TODO - implement
		throw new Error(`Not implemented yet for ${path}`);
	}

	static async loadFromDisk({ fileName }) {
		// TODO - implement
		throw new Error(`Not implemented yet for ${fileName}`);
	}

	// should return an instance of LogicFunction
	static async getByIdOrName({ id, name, list }) {
		const logicFunctionData = list.find(lf => lf.id === id || lf.name === name);
		if (!logicFunctionData) {
			throw new Error('Logic function not found');
		}
		return logicFunctionData;
	}

	get configurationPath () {
		return path.join(this._path, this.fileNames.configuration);
	}

	get sourcePath () {
		return path.join(this._path, this.fileNames.sourceCode);
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
		await fs.writeFile(this.sourcePath, this.source.code);
	}

	_toJSONString(){
		return JSON.stringify({
			id: this.id,
			name: this.name,
			description: this.description,
			version: this.version,
			enabled: this.enabled,
			source: {
				type: this.source.type,
			},
			logic_triggers: this.triggers
		}, null, 2);
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
