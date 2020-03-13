const version = '1.0.0';


module.exports.JSONResult = class JSONResult {
	constructor(meta, data = {}){
		this.meta = Object.assign({ version }, meta);
		this.data = data;
	}

	toString(){
		return JSON.stringify(this, null, 4);
	}

	toJSON(){
		const { meta, data } = this;
		return { meta, data };
	}
};

module.exports.JSONErrorResult = class JSONErrorResult extends Error {
	constructor(cause = new Error('Something went wrong')){
		super(cause.message);
		this.cause = cause;
		this.meta = { version };
	}

	toString(){
		return JSON.stringify(this, null, 4);
	}

	toJSON(){
		const { meta, cause } = this;
		const names = Object.getOwnPropertyNames(cause);
		const error = {};

		for (const name of names){
			error[name] = this[name];
		}

		return { meta, error };
	}
};

