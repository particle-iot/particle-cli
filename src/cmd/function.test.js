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
		it('prints the return value', () => {
			ParticleAPI.prototype.callFunction.resolves({ ok: true, return_value: 42 });
			return command.callFunction({ params: { device, function: fn, argument: arg } })
				.then(() => {
					expect(stdout.content).to.eql(`42${os.EOL}`);
					expect(product).to.equal(undefined);
					expect(ParticleAPI.prototype.callFunction)
						.to.have.property('callCount', 1);
					expect(ParticleAPI.prototype.callFunction.firstCall.args)
						.to.eql([device, fn, arg, product]);
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
						.to.eql([device, fn, arg, product]);
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
					expect(error).to.have.property('message', `Error calling function: \`${fn}\`: Function fn not found`);
				});
		});
	});
});

