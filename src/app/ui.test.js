const { expect, sinon } = require('../../test/setup');
const { Spinner } = require('cli-spinner');
const inquirer = require('inquirer');
const log = require('../lib/log');
const ui = require('./ui');


describe('UI', () => {
	const sandbox = sinon.createSandbox();
	const originalIsInteractive = global.isInteractive;

	afterEach(() => {
		global.isInteractive = originalIsInteractive;
		sandbox.restore();
	});

	describe('Prompt', () => {
		let question;

		beforeEach(() => {
			global.isInteractive = true;
			sandbox.stub(inquirer, 'prompt').resolves({ ok: true });
			question = { type: 'confirm', name: 'ok', message: 'testing...' };
		});

		it('Shows prompt', async () => {
			const promise = ui.prompt(question);

			expect(promise).to.have.property('then');

			const result = await promise;

			expect(result).to.eql({ ok: true });
			expect(inquirer.prompt).to.have.property('callCount', 1);
			expect(inquirer.prompt.firstCall.args).to.eql([question]);
		});

		it('Throws when terminal is NOT interactive', async () => {
			global.isInteractive = false;

			const promise = ui.prompt(question);
			let error;

			expect(promise).to.have.property('then');

			try {
				await promise;
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'Prompts are not allowed in non-interactive mode');
			expect(inquirer.prompt).to.have.property('callCount', 0);
		});
	});

	describe('Spin', () => {
		let msg, operation;

		beforeEach(() => {
			global.isInteractive = true;
			global.verboseLevel = 1;
			sandbox.stub(Spinner.prototype, 'start');
			sandbox.stub(Spinner.prototype, 'stop');
			sandbox.stub(log, 'debug');
			operation = defer();
			msg = 'testing...';
		});

		it('Shows a spinner', async () => {
			const promise = ui.spin(operation.promise, msg);

			expect(promise).to.have.property('then');
			expect(Spinner.prototype.start).to.have.property('callCount', 1);
			expect(Spinner.prototype.start.firstCall.args).to.eql([]);

			operation.resolve('ok');
			const result = await promise;

			expect(result).to.equal('ok');
			expect(log.debug).to.have.property('callCount', 0);
			expect(Spinner.prototype.stop).to.have.property('callCount', 1);
			expect(Spinner.prototype.stop.firstCall.args).to.eql([true]);
		});

		it('Does nothing when terminal is NOT interactive', async () => {
			global.isInteractive = false;

			const promise = ui.spin(operation.promise, msg);

			expect(promise).to.have.property('then');
			expect(Spinner.prototype.start).to.have.property('callCount', 0);

			operation.resolve('ok');
			const result = await promise;

			expect(result).to.equal('ok');
			expect(log.debug).to.have.property('callCount', 0);
			expect(Spinner.prototype.stop).to.have.property('callCount', 0);
		});

		it('Logs message but does not show spinner when log level > 1', async () => {
			global.verboseLevel = 2;

			const promise = ui.spin(operation.promise, msg);

			expect(promise).to.have.property('then');
			expect(Spinner.prototype.start).to.have.property('callCount', 0);

			operation.resolve('ok');
			const result = await promise;

			expect(result).to.equal('ok');
			expect(log.debug).to.have.property('callCount', 1);
			expect(log.debug.firstCall.args).to.eql([msg]);
			expect(Spinner.prototype.stop).to.have.property('callCount', 0);
		});

		it('Throws when promise rejects', async () => {
			const promise = ui.spin(operation.promise, msg);
			let error;

			expect(promise).to.have.property('then');
			expect(Spinner.prototype.start).to.have.property('callCount', 1);
			expect(Spinner.prototype.start.firstCall.args).to.eql([]);

			try {
				operation.reject(new Error('nope'));
				await promise;
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'nope');
			expect(log.debug).to.have.property('callCount', 0);
			expect(Spinner.prototype.stop).to.have.property('callCount', 1);
			expect(Spinner.prototype.stop.firstCall.args).to.eql([true]);
		});
	});

	function defer(){
		let resolve, reject;

		const promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});

		return { resolve, reject, promise };
	}
});

