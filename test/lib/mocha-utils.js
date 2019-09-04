//
// TODO (mirande): cli commands should have an option to wait for an operation
// to complete (e.g. `--wait`)
module.exports.runForAtLeast = (secs, fn) => {
	const { delay } = module.exports;

	return async () => {
		const end = Date.now() + (secs * 1000);
		const result = await fn();

		if (end > Date.now()){
			await delay(end - Date.now());
		}
		return result;
	};
};

// TODO (mirande): use @particle/async-utils
module.exports.delay = (ms, value) => {
	return new Promise((resolve) => setTimeout(() => resolve(value), ms));
};

// TODO (mirande): figure out a better approach. this allows us to verify
// log output without supressing mocha's success / error messages but is a
// bit awkward
module.exports.withConsoleStubs = (sandbox, fn) => {
	return () => {
		let result;

		sandbox.stub(process.stdout, 'write');
		sandbox.stub(process.stderr, 'write');

		try {
			result = fn();
		} catch (error){
			sandbox.restore();
			throw error;
		}

		if (result && typeof result.finally === 'function'){
			return result.finally(() => sandbox.restore());
		}
		sandbox.restore();
		return result;
	};
};

