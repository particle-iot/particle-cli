'use strict';
const { expect, sinon } = require('../../test/setup');
const settings = require('../../settings');
const ParticleApi = require('./api');
const WebhookCommand = require('./webhook');
const inquirer = require('inquirer');
const { MissingTokenError, InvalidTokenError } = require('../lib/auth-errors');

describe('WebhookCommand', () => {
	const sandbox = sinon.createSandbox();

	beforeEach(() => {
		sandbox.stub(settings, 'access_token').value('valid-token');
		sandbox.stub(console, 'log');
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('auth pre-flight', () => {
		it('listHooks throws MissingTokenError when no token is configured', async () => {
			settings.access_token = null;
			const cmd = new WebhookCommand();
			try {
				await cmd.listHooks();
				throw new Error('expected to throw');
			} catch (err) {
				expect(err).to.be.instanceof(MissingTokenError);
			}
		});

		it('createHook throws MissingTokenError when no token is configured', () => {
			settings.access_token = null;
			const cmd = new WebhookCommand();
			expect(() => cmd._createHook({ eventName: 'e', url: 'https://x' }))
				.to.throw(MissingTokenError);
		});
	});

	describe('listHooks', () => {
		it('calls api.listWebhooks() and logs each hook', async () => {
			const hooks = [
				{ id: 'h1', event: 'e1', url: 'https://x', created_at: 't1' },
				{ id: 'h2', event: 'e2', url: 'https://y', deviceID: 'd2', created_at: 't2' }
			];
			sandbox.stub(ParticleApi.prototype, 'listWebhooks').resolves(hooks);

			const cmd = new WebhookCommand();
			await cmd.listHooks();

			expect(ParticleApi.prototype.listWebhooks).to.have.been.calledOnce;
			expect(console.log).to.have.been.calledWithMatch(/Found 2 hooks/);
		});

		it('propagates InvalidTokenError without rewrapping', async () => {
			sandbox.stub(ParticleApi.prototype, 'listWebhooks').rejects(new InvalidTokenError('expired'));
			const cmd = new WebhookCommand();
			try {
				await cmd.listHooks();
				throw new Error('expected to throw');
			} catch (err) {
				expect(err).to.be.instanceof(InvalidTokenError);
			}
		});
	});

	describe('deleteHook', () => {
		it('deletes a single hook by id', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'deleteWebhook').resolves({ ok: true });
			const cmd = new WebhookCommand();
			await cmd.deleteHook({ hookId: 'h42' });
			expect(stub).to.have.been.calledWith({ hookId: 'h42' });
		});

		it('deletes all hooks when hookId is "all" and the user confirms', async () => {
			sandbox.stub(inquirer, 'prompt').resolves({ deleteAll: true });
			sandbox.stub(ParticleApi.prototype, 'listWebhooks').resolves([
				{ id: 'h1' },
				{ id: 'h2' }
			]);
			const deleteStub = sandbox.stub(ParticleApi.prototype, 'deleteWebhook').resolves({ ok: true });

			const cmd = new WebhookCommand();
			await cmd.deleteHook({ hookId: 'all' });

			expect(deleteStub).to.have.been.calledTwice;
			expect(deleteStub.firstCall).to.have.been.calledWith({ hookId: 'h1' });
			expect(deleteStub.secondCall).to.have.been.calledWith({ hookId: 'h2' });
		});

		it('aborts the "all" path when the user declines', async () => {
			sandbox.stub(inquirer, 'prompt').resolves({ deleteAll: false });
			const listStub = sandbox.stub(ParticleApi.prototype, 'listWebhooks');
			const deleteStub = sandbox.stub(ParticleApi.prototype, 'deleteWebhook');

			const cmd = new WebhookCommand();
			await cmd.deleteHook({ hookId: 'all' });

			expect(listStub).to.not.have.been.called;
			expect(deleteStub).to.not.have.been.called;
		});
	});

	describe('_createHook', () => {
		it('POSTs the assembled webhook payload', async () => {
			const responseBody = { ok: true, id: 'new-hook' };
			const stub = sandbox.stub(ParticleApi.prototype, 'createWebhookWithObj').resolves(responseBody);

			const cmd = new WebhookCommand();
			const result = await cmd.createPOSTHook({ eventName: 'temperature', url: 'https://my.app', device: 'abc' });

			expect(result).to.deep.equal(responseBody);
			expect(stub).to.have.been.calledWith(sinon.match({
				event: 'temperature',
				url: 'https://my.app',
				deviceid: 'abc',
				requestType: 'POST'
			}));
		});
	});
});
