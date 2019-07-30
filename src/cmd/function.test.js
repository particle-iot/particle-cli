const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../test/setup');

const stubs = {
	api: {
		ensureToken: () => {},
		callFunction: () => {},
		normalizedApiError: (resp) => new Error(resp.error),
	},
	ApiClient: function ApiClient(){
		return stubs.api;
	}
};

const FunctionCommand = proxyquire('./function', {
	'../lib/api-client': stubs.ApiClient
});


describe('Function Command', () => {
	const sandbox = sinon.createSandbox();
	let deviceId, functionName, functionParam;

	beforeEach(() => {
		deviceId = 'test-device';
		functionName = 'fn';
		functionParam = 'param';
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('when the function succeeds', () => {
		it('prints the return value', withConsoleStubs(() => {
			const { func, api } = stubForFunction(new FunctionCommand(), stubs);
			api.callFunction.resolves({ ok: true, return_value: 42 });

			return func.callFunction(deviceId, functionName, functionParam).then(() => {
				expectSuccessMessage(42);
			});
		}));

		it('prints the return value of 0', withConsoleStubs(() => {
			const { func, api } = stubForFunction(new FunctionCommand(), stubs);
			api.callFunction.resolves({ ok: true, return_value: 0 });

			return func.callFunction(deviceId, functionName, functionParam).then(() => {
				expectSuccessMessage(0);
			});
		}));
	});

	describe('when the function does not exist', () => {
		it('rejects with an error',() => {
			const { func, api } = stubForFunction(new FunctionCommand(), stubs);
			api.callFunction.resolves({
				ok: false,
				error: `Function ${functionName} not found`
			});

			return func.callFunction(deviceId, functionName, functionParam).then(() => {
				throw new Error('expected promise to be rejected');
			}).catch(error => {
				expect(error).to.have.property('message', `Function call failed: Function ${functionName} not found`);
			});
		});
	});

	function expectSuccessMessage(value){
		expect(process.stdout.write).to.have.property('callCount', 1);
		expect(process.stdout.write.firstCall.args[0])
			.to.match(new RegExp(`${value}\\n$`));
	}

	function stubForFunction(func, stubs){
		const { api } = stubs;
		sandbox.stub(api, 'ensureToken');
		sandbox.stub(api, 'callFunction');
		return { func, api };
	}

	// TODO (mirande): figure out a better approach. this allows us to verify
	// log output without supressing mocha's success / error messages but is a
	// bit awkward
	function withConsoleStubs(fn){

		return () => {
			let result;

			sandbox.stub(process.stdout, 'write');
			sandbox.stub(process.stderr, 'write');

			try {
				result = fn();
			} catch (error) {
				sandbox.restore();
				throw error;
			}

			if (result && typeof result.finally === 'function'){
				return result.finally(() => sandbox.restore());
			}
			sandbox.restore();
			return result;
		};
	}
});

