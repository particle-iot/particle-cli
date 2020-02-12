const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../test/setup');
const { withConsoleStubs } = require('../../test/lib/mocha-utils');

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
	let device, fn, arg;

	beforeEach(() => {
		device = 'test-device';
		fn = 'fn';
		arg = 'param';
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('when the function succeeds', () => {
		it('prints the return value', withConsoleStubs(sandbox, () => {
			const { cmd, api } = stubForFunction(new FunctionCommand(), stubs);
			api.callFunction.resolves({ ok: true, return_value: 42 });

			return cmd.callFunction({ params: { device, function: fn, argument: arg } })
				.then(() => expectSuccessMessage(42));
		}));

		it('prints the return value of 0', withConsoleStubs(sandbox, () => {
			const { cmd, api } = stubForFunction(new FunctionCommand(), stubs);
			api.callFunction.resolves({ ok: true, return_value: 0 });

			return cmd.callFunction({ params: { device, function: fn, argument: arg } })
				.then(() => expectSuccessMessage(0));
		}));
	});

	describe('when the function does not exist', () => {
		it('rejects with an error',() => {
			const { cmd, api } = stubForFunction(new FunctionCommand(), stubs);
			api.callFunction.resolves({
				ok: false,
				error: `Function ${fn} not found`
			});

			return cmd.callFunction({ params: { device, function: fn, argument: arg } })
				.then(() => {
					throw new Error('expected promise to be rejected');
				})
				.catch(error => {
					expect(error).to.have.property('message', `Function call failed: Function ${fn} not found`);
				});
		});
	});

	function expectSuccessMessage(value){
		expect(process.stdout.write).to.have.property('callCount', 1);
		expect(process.stdout.write.firstCall.args[0])
			.to.match(new RegExp(`${value}\\n$`));
	}

	function stubForFunction(cmd, stubs){
		const { api } = stubs;
		sandbox.stub(api, 'ensureToken');
		sandbox.stub(api, 'callFunction');
		return { cmd, api };
	}
});

