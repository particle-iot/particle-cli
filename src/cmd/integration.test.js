'use strict';
const fs = require('fs');
const { expect, sinon } = require('../../test/setup');
const settings = require('../../settings');
const ParticleApi = require('./api');
const IntegrationCommand = require('./integration');
const inquirer = require('inquirer');
const { MissingTokenError, InvalidTokenError } = require('../lib/auth-errors');

describe('IntegrationCommand', () => {
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
			const cmd = new IntegrationCommand();
			try {
				await cmd.listHooks();
				throw new Error('expected to throw');
			} catch (err) {
				expect(err).to.be.instanceof(MissingTokenError);
			}
		});

		it('createHook throws MissingTokenError when no token is configured', async () => {
			settings.access_token = null;
			const cmd = new IntegrationCommand();
			try {
				await cmd._createHook({ eventName: 'e', url: 'https://x' });
				throw new Error('expected to throw');
			} catch (err) {
				expect(err).to.be.instanceof(MissingTokenError);
			}
		});
	});

	describe('listHooks', () => {
		it('lists every integration type by default (no type filter) and logs each one', async () => {
			const hooks = [
				{ id: 'h1', event: 'e1', url: 'https://x', integration_type: 'Webhook', created_at: 't1' },
				{ id: 'g1', event: 'e2', integration_type: 'GoogleMaps', created_at: 't2' }
			];
			const stub = sandbox.stub(ParticleApi.prototype, 'listIntegrations').resolves(hooks);

			const cmd = new IntegrationCommand();
			await cmd.listHooks();

			expect(stub).to.have.been.calledWithMatch({ integrationType: undefined });
			expect(console.log).to.have.been.calledWithMatch(/Found 2 integrations/);
			// The GoogleMaps entry has no url, so the "sending to" line is omitted.
			expect(console.log).to.have.been.calledWithMatch(/GoogleMaps/);
		});

		it('scopes to a single type when one is given', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'listIntegrations').resolves([]);

			const cmd = new IntegrationCommand();
			await cmd.listHooks({ integrationType: 'Webhook' });

			expect(stub).to.have.been.calledWithMatch({ integrationType: 'Webhook' });
		});

		it('normalizes the --type filter casing', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'listIntegrations').resolves([]);

			const cmd = new IntegrationCommand();
			await cmd.listHooks({ integrationType: 'googlemaps' });

			expect(stub).to.have.been.calledWithMatch({ integrationType: 'GoogleMaps' });
		});

		it('rejects an unknown --type filter before calling the API', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'listIntegrations').resolves([]);

			const cmd = new IntegrationCommand();
			let error;
			try {
				await cmd.listHooks({ integrationType: 'Nope' });
			} catch (e) {
				error = e;
			}

			expect(error.message).to.match(/Invalid integration type/);
			expect(stub).to.not.have.been.called;
		});

		it('forwards the org/product scope to the API', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'listIntegrations').resolves([]);

			const cmd = new IntegrationCommand();
			await cmd.listHooks({ org: 'my-org' });

			expect(stub).to.have.been.calledWithMatch({ org: 'my-org' });
		});

		it('propagates InvalidTokenError without rewrapping', async () => {
			sandbox.stub(ParticleApi.prototype, 'listIntegrations').rejects(new InvalidTokenError('expired'));
			const cmd = new IntegrationCommand();
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
			const stub = sandbox.stub(ParticleApi.prototype, 'deleteIntegration').resolves({ ok: true });
			const cmd = new IntegrationCommand();
			await cmd.deleteHook({ hookId: 'h42' });
			expect(stub).to.have.been.calledWith(sinon.match({ integrationId: 'h42' }));
		});

		it('forwards the org/product scope to the API', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'deleteIntegration').resolves({ ok: true });
			const cmd = new IntegrationCommand();
			await cmd.deleteHook({ hookId: 'h42', product: 'my-product' });
			expect(stub).to.have.been.calledWith(sinon.match({ integrationId: 'h42', product: 'my-product' }));
		});

		it('deletes integrations of every type when hookId is "all" and the user confirms', async () => {
			sandbox.stub(inquirer, 'prompt').resolves({ deleteAll: true });
			const listStub = sandbox.stub(ParticleApi.prototype, 'listIntegrations').resolves([
				{ id: 'h1', integration_type: 'Webhook' },
				{ id: 'g1', integration_type: 'GoogleMaps' }
			]);
			const deleteStub = sandbox.stub(ParticleApi.prototype, 'deleteIntegration').resolves({ ok: true });

			const cmd = new IntegrationCommand();
			await cmd.deleteHook({ hookId: 'all' });

			expect(listStub).to.have.been.calledWithMatch({ integrationType: undefined });
			expect(deleteStub).to.have.been.calledTwice;
			expect(deleteStub.firstCall).to.have.been.calledWith(sinon.match({ integrationId: 'h1' }));
			expect(deleteStub.secondCall).to.have.been.calledWith(sinon.match({ integrationId: 'g1' }));
		});

		it('scopes "delete all" to a single (normalized) type when --type is given', async () => {
			sandbox.stub(inquirer, 'prompt').resolves({ deleteAll: true });
			const listStub = sandbox.stub(ParticleApi.prototype, 'listIntegrations').resolves([{ id: 'g1', integration_type: 'GoogleMaps' }]);
			const deleteStub = sandbox.stub(ParticleApi.prototype, 'deleteIntegration').resolves({ ok: true });

			const cmd = new IntegrationCommand();
			await cmd.deleteHook({ hookId: 'all', integrationType: 'googlemaps' });

			expect(listStub).to.have.been.calledWithMatch({ integrationType: 'GoogleMaps' });
			expect(deleteStub).to.have.been.calledOnce;
			expect(deleteStub).to.have.been.calledWith(sinon.match({ integrationId: 'g1' }));
		});

		it('rejects an unknown --type before prompting or calling the API', async () => {
			const promptStub = sandbox.stub(inquirer, 'prompt');
			const listStub = sandbox.stub(ParticleApi.prototype, 'listIntegrations');

			const cmd = new IntegrationCommand();
			let error;
			try {
				await cmd.deleteHook({ hookId: 'all', integrationType: 'Nope' });
			} catch (e) {
				error = e;
			}

			expect(error.message).to.match(/Invalid integration type/);
			expect(promptStub).to.not.have.been.called;
			expect(listStub).to.not.have.been.called;
		});

		it('aborts the "all" path when the user declines', async () => {
			sandbox.stub(inquirer, 'prompt').resolves({ deleteAll: false });
			const listStub = sandbox.stub(ParticleApi.prototype, 'listIntegrations');
			const deleteStub = sandbox.stub(ParticleApi.prototype, 'deleteIntegration');

			const cmd = new IntegrationCommand();
			await cmd.deleteHook({ hookId: 'all' });

			expect(listStub).to.not.have.been.called;
			expect(deleteStub).to.not.have.been.called;
		});
	});

	describe('_createHook', () => {
		it('POSTs the assembled integration payload', async () => {
			const responseBody = { ok: true, id: 'new-hook' };
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves(responseBody);

			const cmd = new IntegrationCommand();
			const result = await cmd.createPOSTHook({ eventName: 'temperature', url: 'https://my.app', device: 'abc' });

			expect(result).to.deep.equal(responseBody);
			expect(stub).to.have.been.calledWith(sinon.match({
				event: 'temperature',
				url: 'https://my.app',
				deviceid: 'abc',
				requestType: 'POST'
			}));
		});

		it('defaults the integration type to Webhook', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({ id: 'new-hook' });

			const cmd = new IntegrationCommand();
			await cmd.createHook({ eventName: 'temperature', url: 'https://my.app', requestType: 'POST' });

			expect(stub).to.have.been.calledWithMatch(
				sinon.match.any,
				{ integrationType: 'Webhook' }
			);
		});

		it('forwards the org/product scope', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({ id: 'new-hook' });

			const cmd = new IntegrationCommand();
			await cmd.createHook({ eventName: 'temperature', url: 'https://my.app', requestType: 'POST', org: 'my-org' });

			expect(stub).to.have.been.calledWithMatch(
				sinon.match({ event: 'temperature' }),
				{ org: 'my-org', integrationType: 'Webhook' }
			);
		});

		it('requires an event name', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({});

			const cmd = new IntegrationCommand();
			let error;
			try {
				await cmd.createHook({ url: 'https://x' });
			} catch (e) {
				error = e;
			}

			expect(error.message).to.match(/specify an event name/);
			expect(stub).to.not.have.been.called;
		});

		it('requires a url', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({});

			const cmd = new IntegrationCommand();
			let error;
			try {
				await cmd.createHook({ eventName: 'e' });
			} catch (e) {
				error = e;
			}

			expect(error.message).to.match(/specify a url/);
			expect(stub).to.not.have.been.called;
		});

		it('does not require a url for non-webhook integration types', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({ id: 'gmap-1', ok: true });

			const cmd = new IntegrationCommand();
			await cmd._createHook({ eventName: 'deviceLocator', integrationType: 'GoogleMaps' });

			expect(stub).to.have.been.calledWithMatch(
				sinon.match.any,
				{ integrationType: 'GoogleMaps' }
			);
		});

		it('normalizes the integration type casing to what the backend expects', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({ id: 'gmap-3', ok: true });

			const cmd = new IntegrationCommand();
			await cmd._createHook({ eventName: 'deviceLocator', integrationType: 'googlemaps' });

			expect(stub).to.have.been.calledWithMatch(
				sinon.match.any,
				{ integrationType: 'GoogleMaps' }
			);
		});

		it('rejects an unknown integration type before calling the API', async () => {
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({});

			const cmd = new IntegrationCommand();
			let error;
			try {
				await cmd._createHook({ eventName: 'e', url: 'https://x', integrationType: 'NotARealType' });
			} catch (e) {
				error = e;
			}

			expect(error.message).to.match(/Invalid integration type/);
			expect(error.message).to.match(/Webhook, GoogleMaps, GoogleCloudPubSub, AzureIotHub/);
			expect(stub).to.not.have.been.called;
		});

		it('lets the --type flag win over integration_type in the file', async () => {
			sandbox.stub(fs, 'existsSync').returns(true);
			sandbox.stub(fs, 'readFileSync').returns(JSON.stringify({
				event: 'deviceLocator',
				integration_type: 'Webhook',
				url: ''
			}));
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({ id: 'gmap-4', ok: true });

			const cmd = new IntegrationCommand();
			await cmd.createHook({ eventName: 'gmaps.json', integrationType: 'GoogleMaps' });

			expect(stub).to.have.been.calledWithMatch(
				sinon.match.any,
				{ integrationType: 'GoogleMaps' }
			);
		});

		it('honors integration_type from a .json file when deciding to require a url', async () => {
			// A real GoogleMaps integration has an empty url; the type lives in the file.
			const payload = {
				name: 'google-map-test',
				event: 'deviceLocator',
				template: 'google-maps',
				url: '',
				api_key: 'AIzaSyDUMMYKEY1234567890ABCDEFGHIJKLMNO',
				integration_type: 'GoogleMaps'
			};
			sandbox.stub(fs, 'existsSync').returns(true);
			sandbox.stub(fs, 'readFileSync').returns(JSON.stringify(payload));
			const stub = sandbox.stub(ParticleApi.prototype, 'createIntegrationWithObj').resolves({ id: 'gmap-2', ok: true });

			const cmd = new IntegrationCommand();
			await cmd.createHook({ eventName: 'google-map-test.json' });

			expect(stub).to.have.been.calledWithMatch(
				sinon.match({ event: 'deviceLocator', integration_type: 'GoogleMaps' }),
				{ integrationType: 'GoogleMaps' }
			);
		});
	});
});
