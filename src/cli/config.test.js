'use strict';
const { expect, sinon } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const config = require('./config');
const secrets = require('../lib/secrets');

describe('Config Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		config({ root, commandProcessor });
	});

	describe('`config env` Namespace', () => {
		it('Handles `env list` command', () => {
			const argv = commandProcessor.parse(root, ['config', 'env', 'list', '--sandbox']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.sandbox).to.equal(true);
		});

		it('Handles `env set` command with name and value', () => {
			const argv = commandProcessor.parse(root, ['config', 'env', 'set', 'MY_VAR', 'my-value', '--sandbox']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ name: 'MY_VAR', value: 'my-value' });
		});

		it('Handles `env set` command with name=value format', () => {
			const argv = commandProcessor.parse(root, ['config', 'env', 'set', 'MY_VAR=my-value', '--org', 'my-org']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ name: 'MY_VAR=my-value', value: undefined });
			expect(argv.org).to.equal('my-org');
		});

		it('Handles `env delete` command', () => {
			const argv = commandProcessor.parse(root, ['config', 'env', 'delete', 'MY_VAR', '--product', '1234']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ name: 'MY_VAR' });
			expect(argv.product).to.equal('1234');
		});

		it('Errors when `env set` is missing the name', () => {
			const argv = commandProcessor.parse(root, ['config', 'env', 'set']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'name\' is required.');
		});

		it('Errors when `env delete` is missing the name', () => {
			const argv = commandProcessor.parse(root, ['config', 'env', 'delete']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'name\' is required.');
		});
	});

	describe('`config secrets` Namespace', () => {
		it('Handles `secrets list` command', () => {
			const argv = commandProcessor.parse(root, ['config', 'secrets', 'list', '--sandbox']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.sandbox).to.equal(true);
		});

		it('Handles `secrets get` command', () => {
			const argv = commandProcessor.parse(root, ['config', 'secrets', 'get', 'MY_SECRET', '--sandbox']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ name: 'MY_SECRET' });
			expect(argv.sandbox).to.equal(true);
		});

		it('Handles `secrets set` command with name and value', () => {
			const argv = commandProcessor.parse(root, ['config', 'secrets', 'set', 'MY_SECRET', 'secret-value', '--sandbox']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ name: 'MY_SECRET', value: 'secret-value' });
		});

		it('Handles `secrets delete` command', () => {
			const argv = commandProcessor.parse(root, ['config', 'secrets', 'delete', 'MY_SECRET', '--org', 'my-org']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ name: 'MY_SECRET' });
			expect(argv.org).to.equal('my-org');
		});

		it('Errors when `secrets get` is missing the name', () => {
			const argv = commandProcessor.parse(root, ['config', 'secrets', 'get']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'name\' is required.');
		});

		it('Errors when `secrets delete` is missing the name', () => {
			expect(commandProcessor.parse(root, ['config', 'secrets', 'delete']).clierror)
				.to.have.property('message', 'Parameter \'name\' is required.');
		});
	});

	describe('Parsed arguments passed through to the secrets handlers', () => {
		let secretsStub;

		beforeEach(() => {
			secretsStub = {
				get: sinon.stub(secrets, 'get').resolves({ name: 'MY_SECRET' }),
				update: sinon.stub(secrets, 'update').resolves({ name: 'MY_SECRET' }),
				remove: sinon.stub(secrets, 'remove').resolves(true)
			};
		});

		afterEach(() => {
			sinon.restore();
		});

		function createSecretsCommand(argv) {
			const SecretsCommand = require('../cmd/secrets');
			const command = new SecretsCommand(argv);
			command.ui = {
				write: sinon.stub(),
				showBusySpinnerUntilResolved: sinon.stub().callsFake((text, promise) => promise),
				chalk: {
					cyan: { bold: sinon.stub().callsFake((str) => str) },
					dim: sinon.stub().callsFake((str) => str)
				}
			};
			return command;
		}

		it('`secrets get` passes the parsed name to the api', async () => {
			const argv = commandProcessor.parse(root, ['config', 'secrets', 'get', 'MY_SECRET', '--sandbox']);
			await createSecretsCommand(argv).get(argv);
			expect(secretsStub.get).to.have.been.calledWithMatch({ name: 'MY_SECRET', sandbox: true });
		});

		it('`secrets set` passes the parsed name and value to the api', async () => {
			const argv = commandProcessor.parse(root, ['config', 'secrets', 'set', 'MY_SECRET', 'secret-value', '--sandbox']);
			await createSecretsCommand(argv).set(argv);
			expect(secretsStub.update).to.have.been.calledWithMatch({ name: 'MY_SECRET', value: 'secret-value', sandbox: true });
		});

		it('`secrets delete` passes the parsed name to the api', async () => {
			const argv = commandProcessor.parse(root, ['config', 'secrets', 'delete', 'MY_SECRET', '--org', 'my-org']);
			await createSecretsCommand(argv).deleteSecret(argv);
			expect(secretsStub.remove).to.have.been.calledWithMatch({ name: 'MY_SECRET', org: 'my-org' });
		});
	});
});
