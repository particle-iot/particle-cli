const ParticleAPI = require('../cmd/api');
const settings = require('../../settings');

class LogicFunction {
	constructor({ org, api = createAPI() }) {
		// throw if api is not provided
		this.org = org;
		this.api = api;
		this.configuration = {};
		this.source = {
			type: '',
			code: ''
		};
		this.fileNames = {
			source: '',
			configuration: ''
		};
	}

	static async listFromCloud({ org, api = createAPI() } = {}) {
		const response = await api.getLogicFunctionList({ org: org });
		const logicFunctions = response.logic_functions;
		return logicFunctions;
	}

	static async listFromDisk({ path }) {
		// TODO - implement
		throw new Error(`Not implemented yet for ${path}`);
	}

	// should return an instance of LogicFunction
	static async getByIdOrName({ id, name, list }) {
		// TODO - implement
		throw new Error(`Not implemented yet for ${id} or ${name} or ${list}`);
		// throw new Error(`Not implemented yet for ${id} or ${name}`);
	}

	saveToDisk(path){
		// TODO - implement
		throw new Error(`Not implemented yet for ${path}`);
	}
}

function createAPI() {
	return new ParticleAPI(settings.apiUrl, {
		accessToken: settings.access_token
	});
}

module.exports = LogicFunction;
