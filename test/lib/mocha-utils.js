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

		sandbox.spy(process.stdout, 'write');

		if (process.stdout.isTTY){
			sandbox.stub(process.stdout, 'isTTY').get(() => false);
		}

		sandbox.spy(process.stderr, 'write');

		if (process.stderr.isTTY){
			sandbox.stub(process.stderr, 'isTTY').get(() => false);
		}

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

