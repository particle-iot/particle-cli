const { expect, sinon } = require('../../../test/setup');
const executor = require('./executor');


describe('wifi executor', () => {
	const sandbox = sinon.createSandbox();

	afterEach(() => {
		sandbox.restore();
	});

	describe('System Executor', () => {
		const { systemExecutor } = executor;
		let fakeCmdArgs, fakeStdOut, fakeStdErr, fakeCode;

		beforeEach(() => {
			sandbox.stub(executor, 'runCommand');
			fakeCmdArgs = ['a', 'b', 'c'];
			fakeStdOut = 'ok';
			fakeStdErr = '';
			fakeCode = 0;
		});

		it('runs executor', async () => {
			executor.runCommand.callsArgWith(2, null, fakeCode, fakeStdOut, fakeStdErr);
			const stdout = await systemExecutor(fakeCmdArgs);

			expect(stdout).to.equal(fakeStdOut);
			expect(executor.runCommand).to.have.property('callCount', 1);
			expect(executor.runCommand.firstCall.args[0]).to.equal('a');
			expect(executor.runCommand.firstCall.args[1]).to.eql(['b', 'c']);
			expect(executor.runCommand.firstCall.args[2]).to.be.a('function');
		});

		it('rejects with data when executor fails', async () => {
			const error = new Error('nope');
			let data;

			try {
				executor.runCommand.callsArgWith(2, error, fakeCode, fakeStdOut, fakeStdErr);
				await systemExecutor(fakeCmdArgs);
			} catch (d){
				data = d;
			}

			expect(data).to.eql({ code: fakeCode, err: error, stderr: fakeStdErr, stdout: fakeStdOut });
			expect(executor.runCommand).to.have.property('callCount', 1);
			expect(executor.runCommand.firstCall.args[0]).to.equal('a');
			expect(executor.runCommand.firstCall.args[1]).to.eql(['b', 'c']);
			expect(executor.runCommand.firstCall.args[2]).to.be.a('function');
		});
	});
});

