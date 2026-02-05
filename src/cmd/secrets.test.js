'use strict';
const { expect, sinon } = require('../../test/setup');
const SecretsCommand = require('./secrets');
const secrets = require('../lib/secrets');
const settings = require('../../settings');

describe('SecretsCommand', () => {
	let secretsCommand;
	let secretsStub;

	beforeEach(() => {
		secretsCommand = new SecretsCommand();
		secretsCommand.ui = {
			write: sinon.stub(),
			stdout: {
				write: sinon.stub()
			},
			stderr: {
				write: sinon.stub()
			},
			showBusySpinnerUntilResolved: sinon.stub().callsFake((text, promise) => promise),
			prompt: sinon.stub(),
			chalk: {
				bold: sinon.stub().callsFake((str) => str),
				cyan: {
					bold: sinon.stub().callsFake((str) => str)
				},
				dim: sinon.stub().callsFake((str) => str),
			}
		};

		secretsStub = {
			list: sinon.stub(secrets, 'list'),
			get: sinon.stub(secrets, 'get'),
			update: sinon.stub(secrets, 'update'),
			remove: sinon.stub(secrets, 'remove')
		};
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('_validateScope', () => {
		it('throws error when no scope is provided', () => {
			expect(() => {
				secretsCommand._validateScope({});
			}).to.throw('You must specify one of: --sandbox or --org');
		});

		it('throws error when both sandbox and org are provided', () => {
			expect(() => {
				secretsCommand._validateScope({ sandbox: true, org: 'my-org' });
			}).to.throw('You can only specify one scope at a time. You provided: --sandbox, --org');
		});

		it('does not throw when only sandbox is provided', () => {
			expect(() => {
				secretsCommand._validateScope({ sandbox: true });
			}).to.not.throw();
		});

		it('does not throw when only org is provided', () => {
			expect(() => {
				secretsCommand._validateScope({ org: 'my-org' });
			}).to.not.throw();
		});
	});

	describe('list', () => {
		it('lists secrets for sandbox', async () => {
			const mockSecrets = [
				{
					name: 'SECRET_KEY',
					createdAt: '2024-01-01',
					updatedAt: '2024-01-02',
					lastAccessedAt: '2024-01-03',
					usageCount: 2
				}
			];
			secretsStub.list.resolves(mockSecrets);

			await secretsCommand.list({ sandbox: true });

			expect(secretsStub.list).to.have.been.calledOnce;
			expect(secretsCommand.ui.showBusySpinnerUntilResolved).to.have.been.calledWith('Retrieving secrets');
			expect(secretsCommand.ui.write).to.have.been.called;
		});

		it('lists secrets for org', async () => {
			const mockSecrets = [
				{
					name: 'ORG_SECRET',
					createdAt: '2024-01-01',
					updatedAt: '2024-01-02',
					lastAccessedAt: '2024-01-03',
					usageCount: 1
				}
			];
			secretsStub.list.resolves(mockSecrets);

			await secretsCommand.list({ org: 'my-org' });

			expect(secretsStub.list).to.have.been.calledWith({ org: 'my-org', api: secretsCommand.api, sandbox: undefined });
			expect(secretsCommand.ui.showBusySpinnerUntilResolved).to.have.been.calledWith('Retrieving secrets');
		});

		it('outputs JSON when json flag is set', async () => {
			const mockSecrets = [
				{
					name: 'SECRET_KEY',
					createdAt: '2024-01-01',
					updatedAt: '2024-01-02',
					lastAccessedAt: '2024-01-03',
					usageCount: 2
				}
			];
			secretsStub.list.resolves(mockSecrets);

			await secretsCommand.list({ sandbox: true, json: true });

			expect(secretsCommand.ui.write).to.have.been.calledWith(JSON.stringify(mockSecrets, null, 2));
		});

		it('throws error when no scope provided', async () => {
			try {
				await secretsCommand.list({});
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error.message).to.equal('You must specify one of: --sandbox or --org');
			}
		});
	});

	describe('get', () => {
		it('gets a specific secret from sandbox', async () => {
			const mockSecret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: '2024-01-03',
				logicFunctions: [],
				integrations: []
			};
			secretsStub.get.resolves(mockSecret);

			await secretsCommand.get({ params: { key: 'MY_SECRET' }, sandbox: true });

			expect(secretsStub.get).to.have.been.calledWith({
				api: secretsCommand.api,
				name: 'MY_SECRET',
				org: undefined,
				sandbox: true
			});
			expect(secretsCommand.ui.showBusySpinnerUntilResolved).to.have.been.calledWith('Retrieving secret');
		});

		it('gets a specific secret from org', async () => {
			const mockSecret = {
				name: 'ORG_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: [],
				integrations: []
			};
			secretsStub.get.resolves(mockSecret);

			await secretsCommand.get({ params: { key: 'ORG_SECRET' }, org: 'my-org' });

			expect(secretsStub.get).to.have.been.calledWith({
				api: secretsCommand.api,
				name: 'ORG_SECRET',
				org: 'my-org',
				sandbox: undefined
			});
		});
	});

	describe('deleteSecret', () => {
		it('deletes a secret from sandbox', async () => {
			secretsStub.remove.resolves(true);

			await secretsCommand.deleteSecret({ params: { key: 'MY_SECRET' }, sandbox: true });

			expect(secretsStub.remove).to.have.been.calledWith({
				api: secretsCommand.api,
				org: undefined,
				sandbox: true,
				name: 'MY_SECRET'
			});
			expect(secretsCommand.ui.write).to.have.been.calledWith('Secret MY_SECRET deleted successfully.');
		});

		it('deletes a secret from org', async () => {
			secretsStub.remove.resolves(true);

			await secretsCommand.deleteSecret({ params: { key: 'ORG_SECRET' }, org: 'my-org' });

			expect(secretsStub.remove).to.have.been.calledWith({
				api: secretsCommand.api,
				org: 'my-org',
				sandbox: undefined,
				name: 'ORG_SECRET'
			});
			expect(secretsCommand.ui.write).to.have.been.calledWith('Secret ORG_SECRET deleted successfully.');
		});
	});

	describe('set', () => {
		it('sets a secret using key value format', async () => {
			const mockSecret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: [],
				integrations: []
			};
			secretsStub.update.resolves(mockSecret);

			await secretsCommand.set({ params: { key: 'MY_SECRET', value: 'secret-value' }, sandbox: true });

			expect(secretsStub.update).to.have.been.calledWith({
				api: secretsCommand.api,
				name: 'MY_SECRET',
				org: undefined,
				sandbox: true,
				value: 'secret-value'
			});
			expect(secretsCommand.ui.write).to.have.been.calledWith('Secret MY_SECRET set successfully.');
		});

		it('sets a secret using key=value format', async () => {
			const mockSecret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: [],
				integrations: []
			};
			secretsStub.update.resolves(mockSecret);

			await secretsCommand.set({ params: { key: 'MY_SECRET=secret-value' }, sandbox: true });

			expect(secretsStub.update).to.have.been.calledWith({
				api: secretsCommand.api,
				name: 'MY_SECRET',
				org: undefined,
				sandbox: true,
				value: 'secret-value'
			});
		});

		it('sets a secret for org', async () => {
			const mockSecret = {
				name: 'ORG_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: [],
				integrations: []
			};
			secretsStub.update.resolves(mockSecret);

			await secretsCommand.set({ params: { key: 'ORG_SECRET', value: 'org-value' }, org: 'my-org' });

			expect(secretsStub.update).to.have.been.calledWith({
				api: secretsCommand.api,
				name: 'ORG_SECRET',
				org: 'my-org',
				sandbox: undefined,
				value: 'org-value'
			});
		});
	});

	describe('_parseKeyValue', () => {
		it('parses key and value when both are provided', () => {
			const result = secretsCommand._parseKeyValue({ key: 'MY_KEY', value: 'my-value' });
			expect(result).to.deep.equal({ key: 'MY_KEY', value: 'my-value' });
		});

		it('parses key=value format', () => {
			const result = secretsCommand._parseKeyValue({ key: 'MY_KEY=my-value' });
			expect(result).to.deep.equal({ key: 'MY_KEY', value: 'my-value' });
		});

		it('parses key=value format with = in value', () => {
			const result = secretsCommand._parseKeyValue({ key: 'MY_KEY=value=with=equals' });
			expect(result).to.deep.equal({ key: 'MY_KEY', value: 'value=with=equals' });
		});

		it('throws error for invalid format', () => {
			expect(() => {
				secretsCommand._parseKeyValue({ key: 'MY_KEY' });
			}).to.throw('Invalid format. Use either "key value" or "key=value"');
		});

		it('throws error when key is empty in key=value format', () => {
			expect(() => {
				secretsCommand._parseKeyValue({ key: '=value' });
			}).to.throw('Invalid format. Use either "key value" or "key=value"');
		});

		it('throws error when value is empty in key=value format', () => {
			expect(() => {
				secretsCommand._parseKeyValue({ key: 'MY_KEY=' });
			}).to.throw('Invalid format. Use either "key value" or "key=value"');
		});
	});

	describe('_printSecret', () => {
		it('prints secret with usage count', () => {
			const secret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: '2024-01-03',
				usageCount: 5,
				logicFunctions: [],
				integrations: []
			};

			secretsCommand._printSecret(secret);

			expect(secretsCommand.ui.write).to.have.been.calledWith('MY_SECRET');
			expect(secretsCommand.ui.write).to.have.been.calledWith('    Usage count: 5');
			expect(secretsCommand.ui.write).to.have.been.calledWith('    Created at: 2024-01-01');
			expect(secretsCommand.ui.write).to.have.been.calledWith('    Updated at: 2024-01-02');
			expect(secretsCommand.ui.write).to.have.been.calledWith('    Last accessed at: 2024-01-03');
		});

		it('prints secret with logic functions', () => {
			const secret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: ['func1', 'func2'],
				integrations: []
			};

			secretsCommand._printSecret(secret);

			expect(secretsCommand.ui.write).to.have.been.calledWith('    Logic Functions:');
			expect(secretsCommand.ui.chalk.dim).to.have.been.calledWith(sinon.match(/func1/));
			expect(secretsCommand.ui.chalk.dim).to.have.been.calledWith(sinon.match(/func2/));
		});

		it('prints secret with no logic functions', () => {
			const secret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: [],
				integrations: []
			};

			secretsCommand._printSecret(secret);

			expect(secretsCommand.ui.write).to.have.been.calledWith(sinon.match(/Logic Functions:.*\(none\)/));
		});

		it('prints secret with integrations', () => {
			const secret = {
				name: 'MY_SECRET',
				org: 'my-org',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: [],
				integrations: [
					{ id: 'int1', product_slug: null },
					{ id: 'int2', product_slug: 'my-product' }
				]
			};

			secretsCommand._printSecret(secret);

			expect(secretsCommand.ui.write).to.have.been.calledWith('    Integrations:');
			expect(secretsCommand.ui.chalk.dim).to.have.been.calledWith(sinon.match(/int1/));
			expect(secretsCommand.ui.chalk.dim).to.have.been.calledWith(sinon.match(/int2/));
		});

		it('prints secret with no integrations', () => {
			const secret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: [],
				integrations: []
			};

			secretsCommand._printSecret(secret);

			expect(secretsCommand.ui.write).to.have.been.calledWith(sinon.match(/Integrations:.*\(none\)/));
		});

		it('prints "Never accessed" when lastAccessedAt is null', () => {
			const secret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: [],
				integrations: []
			};

			secretsCommand._printSecret(secret);

			expect(secretsCommand.ui.write).to.have.been.calledWith('    Last accessed at: Never accessed');
		});

		it('uses correct console URL for staging', () => {
			sinon.stub(settings, 'isStaging').value(true);
			secretsCommand = new SecretsCommand();
			secretsCommand.ui = {
				write: sinon.stub(),
				chalk: {
					cyan: {
						bold: sinon.stub().callsFake((str) => str)
					},
					dim: sinon.stub().callsFake((str) => str)
				}
			};

			const secret = {
				name: 'MY_SECRET',
				createdAt: '2024-01-01',
				updatedAt: '2024-01-02',
				lastAccessedAt: null,
				logicFunctions: ['func1'],
				integrations: []
			};

			secretsCommand._printSecret(secret);

			expect(secretsCommand.ui.chalk.dim).to.have.been.calledWith(sinon.match(/console.staging.particle.io/));
		});
	});
});
