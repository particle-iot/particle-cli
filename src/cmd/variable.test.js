'use strict';
const os = require('os');
const { expect, sinon } = require('../../test/setup');
const { withConsoleStubs } = require('../../test/lib/mocha-utils');
const VariableCommand = require('./variable');
const { MissingTokenError } = require('../lib/auth-errors');


describe('Variable Command', () => {
	const sandbox = sinon.createSandbox();

	afterEach(() => {
		sandbox.restore();
	});

	describe('Monitoring a variable', () => {
		it('Monitors a variable', withConsoleStubs(sandbox, async () => {
			const cmd = new VariableCommand();
			const device = '000000000000000xdeadbeef';
			const variableName = 'test';

			sandbox.stub(cmd, '_pollForVariable').resolves();
			await cmd.monitorVariables({ params: { device, variableName } });

			expect(process.stdout.write).to.have.callCount(0);
			expect(process.stderr.write).to.have.callCount(1);

			const messages = process.stderr.write.args.map(a => a[0]);

			expect(messages[0]).to.equal(`Hit CTRL-C to stop!${os.EOL}`);
			expect(cmd._pollForVariable).to.have.property('callCount', 1);

			const args = cmd._pollForVariable.firstCall.args;

			expect(args[0]).to.eql([device]);
			expect(args[1]).to.eql(variableName);
			expect(args[2]).to.have.property('delay').that.is.a('number');
			expect(args[2]).to.have.property('time', undefined);
		}));

		it('Prompts for variable name when it is not provided', withConsoleStubs(sandbox, async () => {
			const cmd = new VariableCommand();
			const device = '000000000000000xdeadbeef';
			let args;

			sandbox.stub(cmd, '_pollForVariable').resolves();
			sandbox.stub(cmd, 'disambiguateGetValue').resolves({
				deviceIds: [device],
				variableName: 'prompted'
			});
			await cmd.monitorVariables({ params: { device } });

			expect(cmd.disambiguateGetValue).to.have.property('callCount', 1);
			args = cmd.disambiguateGetValue.firstCall.args;
			expect(args[0]).to.have.property('device', device);
			expect(args[0]).to.have.property('variableName', undefined);
			expect(args).to.have.lengthOf(1);

			expect(cmd._pollForVariable).to.have.property('callCount', 1);
			args = cmd._pollForVariable.firstCall.args;
			expect(args[0]).to.eql([device]);
			expect(args[1]).to.eql('prompted');
			expect(args[2]).to.have.property('delay').that.is.a('number');
			expect(args[2]).to.have.property('time', undefined);
			expect(args).to.have.lengthOf(3);
		}));

		it('Throws when error occurs before polling', async () => {
			const cmd = new VariableCommand();
			const device = '000000000000000xdeadbeef';
			let error;

			sandbox.stub(cmd, '_pollForVariable').resolves();
			sandbox.stub(cmd, 'disambiguateGetValue').rejects(new Error('whoops!'));

			try {
				await cmd.monitorVariables({ params: { device } });
			} catch (e){
				error = e;
			}

			expect(error).to.an.instanceof(Error);
			expect(error).to.have.property('message', 'whoops!');
		});
	});

	describe('_getValue', () => {
		it('rethrows auth errors instead of degrading them into per-row output', withConsoleStubs(sandbox, async () => {
			const cmd = new VariableCommand();
			const api = { getVariable: sandbox.stub().rejects(new MissingTokenError()) };
			sandbox.stub(cmd, '_particleApi').returns({ api });

			let error;
			try {
				await cmd._getValue('000000000000000xdeadbeef', 'test', {});
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(MissingTokenError);
			// Should NOT have written a degraded "Error: ..." row.
			const out = process.stdout.write.args.map(a => a[0]).join('');
			expect(out).to.not.include('Error:');
		}));

		it('still degrades non-auth per-device failures into rows', withConsoleStubs(sandbox, async () => {
			const cmd = new VariableCommand();
			const api = { getVariable: sandbox.stub().rejects(new Error('Variable not found')) };
			sandbox.stub(cmd, '_particleApi').returns({ api });

			let error;
			try {
				await cmd._getValue('000000000000000xdeadbeef', 'test', {});
			} catch (e){
				error = e;
			}

			// Non-auth failure: one row rendered, batch rejects with the summary error.
			const out = process.stdout.write.args.map(a => a[0]).join('');
			expect(out).to.include('Error: Variable not found');
			expect(error).to.have.property('message', 'Some variables could not be read');
		}));
	});
});

