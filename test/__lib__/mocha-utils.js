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

