'use strict';
const { expect, sinon } = require('../../test/setup');
const nock = require('nock');
const { sandboxList, sandboxProductList, sandboxDeviceProductList, emptyList, emptyListWithKeys } = require('../../test/__fixtures__/env-vars/list');
const EnvVarsCommands = require('./env');


describe('config env Command', () => {
	let envVarsCommands;
	beforeEach(() => {
		envVarsCommands = new EnvVarsCommands();
		envVarsCommands.ui = {
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
				cyanBright: sinon.stub().callsFake((str) => str),
				cyan: sinon.stub().callsFake((str) => str),
				yellow: sinon.stub().callsFake((str) => str),
				grey: sinon.stub().callsFake((str) => str),
				gray: sinon.stub().callsFake((str) => str),
				red: sinon.stub().callsFake((str) => str),
				green: sinon.stub().callsFake((str) => str),
			},
		};

		// To allow chaining like chalk.cyan.bold
		envVarsCommands.ui.chalk.cyan.bold = sinon.stub().callsFake((str) => str);
	});

	afterEach(() => {
		sinon.restore();
	});

	function parseBlocksFromCalls(calls) {
		const logicalLines = calls.filter(line => !line.startsWith('---'));

		const blocks = [];
		for (let i = 0; i < logicalLines.length; i += 3) {
			const keyLine = logicalLines[i];
			const valueLine = logicalLines[i + 1];
			const scopeLine = logicalLines[i + 2];

			const key = keyLine;
			const value = valueLine.replace('    Value: ', '');
			const scope = scopeLine.replace('    Scope: ', '');

			blocks.push({ key, value, scope });
		}

		return blocks;
	}

	describe('list', () => {
		it('list all env vars for sandbox user', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env-vars', 'GET')
				.reply(200, sandboxList);
			await envVarsCommands.list({});
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			const blocks = parseBlocksFromCalls(writeCalls);
			expect(blocks).to.deep.equal([
				{ key: 'FOO3', value: 'bar3', scope: 'Owner' },
				{ key: 'FOO2', value: 'bar', scope: 'Owner' },
				{ key: 'FOO', value: 'bar', scope: 'Owner' }
			]);
		});

		it('list all env vars for a product sandbox user', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/products/product-id-123/env-vars', 'GET')
				.reply(200, sandboxProductList);
			await envVarsCommands.list({ product: 'product-id-123' });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			const blocks = parseBlocksFromCalls(writeCalls);
			expect(blocks).to.deep.equal([
				{ key: 'FOO3', value: 'bar3 (Override)', scope: 'Owner' },
				{ key: 'FOO', value: 'bar', scope: 'Owner' }
			]);
		});

		it('list all env vars for a device that belongs to a product', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/products/product-id-123/env-vars/abc123', 'GET')
				.reply(200, sandboxDeviceProductList);
			await envVarsCommands.list({ product: 'product-id-123', device: 'abc123' });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			const blocks = parseBlocksFromCalls(writeCalls);
			expect(blocks).to.deep.equal([
				{ key: 'FOO', value: 'org-bar', scope: 'Owner' },
				{ key: 'FOO3', value: 'bar3 (Override)', scope: 'Owner' },
				{ key: 'FOO3_PROD', value: 'prod-bar3-prod', scope: 'Product' },
				{ key: 'FOO4', value: 'bar', scope: 'Owner' }
			]);
		});

		it('show message for empty list', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env-vars', 'GET')
				.reply(200, emptyList);
			await envVarsCommands.list({ });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith('No environment variables found.');
		});

		it('show message for empty list but existing objects', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env-vars', 'GET')
				.reply(200, emptyListWithKeys);
			await envVarsCommands.list({ });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith('No environment variables found.');
		});
	});
	describe('set env vars', () => {
		it('set env var for sandbox user', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1')
				.intercept('/env-vars', 'PATCH')
				.reply(200, sandboxList);
			await envVarsCommands.setEnvVars({ params });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});

		it('throws an error in case the key, value is invalid', async () => {
			const apiError = {
				error_description: 'Validation error: : Must only contain uppercase letters, numbers, and underscores. Must not start with a number. at "ops[0].key"',
				error:'invalid_request'
			};
			nock('https://api.particle.io/v1')
				.intercept('/env-vars', 'PATCH')
				.reply(400, apiError);
			let error;
			try {
				await envVarsCommands.setEnvVars({ params: { } });
			} catch (_error) {
				error = _error;
			}
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(error.message).to.contains(apiError.error_description);
		});
		it('set env var for specific org', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1/orgs/my-org')
				.intercept('/env-vars', 'PATCH')
				.reply(200, sandboxList);
			await envVarsCommands.setEnvVars({ params, org: 'my-org' });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});
		it('set env var for specific product', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1/products/my-product')
				.intercept('/env-vars', 'PATCH')
				.reply(200, sandboxList);
			await envVarsCommands.setEnvVars({ params, product: 'my-product' });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});
		it('set env var for specific device', async () => {
			const params = { key: 'FOO', value: 'bar' };
			const deviceId = 'abc123';
			nock('https://api.particle.io/v1')
				.intercept(`/env-vars/${deviceId}`, 'PATCH')
				.reply(200, sandboxList);
			await envVarsCommands.setEnvVars({ params, device: deviceId });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});
	});

	describe('delete env vars', () => {
		it('delete env var for sandbox user', async () => {
			let receivedBody;
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1')
				.intercept('/env-vars', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.deleteEnv({ params });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});

		it('delete env var for specific org', async () => {
			let receivedBody;
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1/orgs/my-org')
				.intercept('/env-vars', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.deleteEnv({ params, org: 'my-org' });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});
		it('delete env var for specific product', async () => {
			let receivedBody;
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1/products/my-product')
				.intercept('/env-vars', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.deleteEnv({ params, product: 'my-product' });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});
		it('delete env var for specific device', async () => {
			let receivedBody;
			const params = { key: 'FOO', value: 'bar' };
			const deviceId = 'abc123';
			nock('https://api.particle.io/v1')
				.intercept(`/env-vars/${deviceId}`, 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.deleteEnv({ params, device: deviceId });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});
	});
});
