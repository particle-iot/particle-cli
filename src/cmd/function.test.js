'use strict';
const os = require('os');
const stream = require('stream');
const ParticleAPI = require('./api');
const { expect, sinon } = require('../../test/setup');
const FunctionCommand = require('./function');


describe('Function Command', () => {
	const sandbox = sinon.createSandbox();
	let command, stdin, stdout, stderr, device, fn, arg, product;

	beforeEach(() => {
		sandbox.stub(ParticleAPI.prototype, 'callFunction');

		stdin = new stream.Readable();
		stdout = new stream.Writable({
			write: function write(chunk, encoding, callback){
				this.content = (this.content || '') + chunk;
				callback();
			}
		});
		stderr = new stream.Writable({
			write: function write(chunk, encoding, callback){
				this.errorContent = (this.errorContent || '') + chunk;
				callback();
			}
		});

		command = new FunctionCommand({ stdin, stdout, stderr });
		device = 'test-device';
		fn = 'fn';
		arg = 'param';
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('when the function succeeds', () => {
		beforeEach(() => {
			sandbox.stub(command.ui, 'showBusySpinnerUntilResolved').callsFake((_, p) => p);
		});

		it('prints the return value', () => {
			ParticleAPI.prototype.callFunction.resolves({ ok: true, return_value: 42 });
			return command.callFunction({ params: { device, function: fn, argument: arg } })
				.then(() => {
					expect(stdout.content).to.eql(`42${os.EOL}`);
					expect(product).to.equal(undefined);
					expect(ParticleAPI.prototype.callFunction)
						.to.have.property('callCount', 1);
					expect(ParticleAPI.prototype.callFunction.firstCall.args)
						.to.eql([{ deviceId: device, name: fn, argument: arg, product }]);
				});
		});

		it('prints the return value of 0', () => {
			ParticleAPI.prototype.callFunction.resolves({ ok: true, return_value: 0 });
			return command.callFunction({ params: { device, function: fn, argument: arg } })
				.then(() => {
					expect(stdout.content).to.eql(`0${os.EOL}`);
					expect(product).to.equal(undefined);
					expect(ParticleAPI.prototype.callFunction)
						.to.have.property('callCount', 1);
					expect(ParticleAPI.prototype.callFunction.firstCall.args)
						.to.eql([{ deviceId: device, name: fn, argument: arg, product }]);
				});
		});
	});

	describe('when the function does not exist', () => {
		it('rejects with an error',() => {
			ParticleAPI.prototype.callFunction.resolves({ ok: false, error: `Function ${fn} not found` });
			return command.callFunction({ params: { device, function: fn, argument: arg } })
				.then(() => {
					throw new Error('expected promise to be rejected');
				})
				.catch(error => {
					expect(error).to.have.property('message', 'Function fn not found');
				});
		});
	});

	describe('listFunctions', () => {
		beforeEach(() => {
			sandbox.stub(ParticleAPI.prototype, 'listDevices').resolves([{ id: 'd1', connected: true }]);
			sandbox.stub(ParticleAPI.prototype, 'getDeviceAttributes').resolves({ id: 'd1', functions: [] });
			sandbox.stub(command.ui, 'logDeviceDetail');
		});

		it('lists sandbox devices when no product is given', () => {
			return command.listFunctions().then(() => {
				expect(ParticleAPI.prototype.listDevices.firstCall.args).to.eql([{ product: undefined }]);
				expect(ParticleAPI.prototype.getDeviceAttributes.firstCall.args)
					.to.eql([{ deviceId: 'd1', product: undefined }]);
			});
		});

		it('forwards --product and unwraps the paginated { devices } response', () => {
			// The product endpoint returns a paginated object, not a bare array.
			ParticleAPI.prototype.listDevices.resolves({ devices: [{ id: 'd1', connected: true }], meta: {} });
			return command.listFunctions({ product: 'my-product' }).then(() => {
				expect(ParticleAPI.prototype.listDevices.firstCall.args).to.eql([{ product: 'my-product' }]);
				expect(ParticleAPI.prototype.getDeviceAttributes.firstCall.args)
					.to.eql([{ deviceId: 'd1', product: 'my-product' }]);
			});
		});
	});
});

