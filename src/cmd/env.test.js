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
				.intercept('/env', 'GET')
				.reply(200, sandboxList);
			await envVarsCommands.list({ sandbox: true });
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
				.intercept('/products/product-id-123/env', 'GET')
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

		it('list all env vars for a device', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env/abc123', 'GET')
				.reply(200, sandboxDeviceProductList);
			await envVarsCommands.list({ device: 'abc123' });
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
				.intercept('/env', 'GET')
				.reply(200, emptyList);
			await envVarsCommands.list({ sandbox: true });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith('No environment variables found.');
		});

		it('show message for empty list but existing objects', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, emptyListWithKeys);
			await envVarsCommands.list({ sandbox: true });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith('No environment variables found.');
		});
	});
	describe('set env vars', () => {
		it('set env var for sandbox user', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envVarsCommands.setEnvVars({ params, sandbox: true });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});

		it('throws an error in case the key, value is invalid', async () => {
			const apiError = {
				error_description: 'Validation error: : Must only contain uppercase letters, numbers, and underscores. Must not start with a number. at "ops[0].key"',
				error:'invalid_request'
			};
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply(400, apiError);
			let error;
			try {
				await envVarsCommands.setEnvVars({ params: {}, sandbox: true });
			} catch (_error) {
				error = _error;
			}
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(error.message).to.contains(apiError.error_description);
		});
		it('set env var for specific org', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1/orgs/my-org')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envVarsCommands.setEnvVars({ params, org: 'my-org' });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});
		it('set env var for specific product', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1/products/my-product')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envVarsCommands.setEnvVars({ params, product: 'my-product' });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});
		it('set env var for specific device', async () => {
			const params = { key: 'FOO', value: 'bar' };
			const deviceId = 'abc123';
			nock('https://api.particle.io/v1')
				.intercept(`/env/${deviceId}`, 'PATCH')
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
				.intercept('/env', 'GET')
				.reply(200, {
					env: {
						own: { FOO: { value: 'bar' } },
						inherited: {}
					}
				});
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.deleteEnv({ params, sandbox: true });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});

		it('delete env var for specific org', async () => {
			let receivedBody;
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1/orgs/my-org')
				.intercept('/env', 'GET')
				.reply(200, {
					env: {
						own: { FOO: { value: 'bar' } },
						inherited: {}
					}
				});
			nock('https://api.particle.io/v1/orgs/my-org')
				.intercept('/env', 'PATCH')
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
				.intercept('/env', 'GET')
				.reply(200, {
					env: {
						own: { FOO: { value: 'bar' } },
						inherited: {}
					}
				});
			nock('https://api.particle.io/v1/products/my-product')
				.intercept('/env', 'PATCH')
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
				.intercept(`/env/${deviceId}`, 'GET')
				.reply(200, {
					env: {
						own: { FOO: { value: 'bar' } },
						inherited: {}
					}
				});
			nock('https://api.particle.io/v1')
				.intercept(`/env/${deviceId}`, 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.deleteEnv({ params, device: deviceId });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});

		it('prevents deletion of inherited-only variables', async () => {
			const params = { key: 'INHERITED_VAR' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, {
					env: {
						own: {},
						inherited: {
							INHERITED_VAR: {
								value: 'inherited_value',
								from: 'Organization'
							}
						}
					}
				});

			await envVarsCommands.deleteEnv({ params, sandbox: true });

			expect(envVarsCommands.ui.write).to.have.been.calledWith(
				envVarsCommands.ui.chalk.yellow(`Warning: 'INHERITED_VAR' is inherited from a parent scope and cannot be deleted at this level.`)
			);
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).not.to.have.been.called;
		});

		it('warns about override before deleting', async () => {
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, {
					env: {
						own: { FOO: { value: 'override_value' } },
						inherited: { FOO: { value: 'inherited_value' } }
					}
				});
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply(200, {});

			await envVarsCommands.deleteEnv({ params, sandbox: true });

			expect(envVarsCommands.ui.write).to.have.been.calledWith(
				envVarsCommands.ui.chalk.yellow(`Note: 'FOO' is an overridden variable. If you delete it, the inherited value 'inherited_value' will become visible.`)
			);
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});

		it('supports dry-run mode', async () => {
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, {
					env: {
						own: { FOO: { value: 'bar' } },
						inherited: {}
					}
				});

			await envVarsCommands.deleteEnv({ params, sandbox: true, dryRun: true });

			expect(envVarsCommands.ui.write).to.have.been.calledWith(
				envVarsCommands.ui.chalk.cyan(`[DRY RUN] Would delete environment variable 'FOO'`)
			);
			expect(envVarsCommands.ui.write).to.have.been.calledWith('Current value: bar');
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).not.to.have.been.called;
		});

		it('shows override warning in dry-run mode', async () => {
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, {
					env: {
						own: { FOO: { value: 'override_value' } },
						inherited: { FOO: { value: 'inherited_value' } }
					}
				});

			await envVarsCommands.deleteEnv({ params, sandbox: true, dryRun: true });

			expect(envVarsCommands.ui.write).to.have.been.calledWith(
				envVarsCommands.ui.chalk.yellow(`Note: 'FOO' is an overridden variable. If you delete it, the inherited value 'inherited_value' will become visible.`)
			);
			expect(envVarsCommands.ui.write).to.have.been.calledWith(
				envVarsCommands.ui.chalk.cyan(`[DRY RUN] Would delete environment variable 'FOO'`)
			);
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).not.to.have.been.called;
		});

		it('throws error when trying to delete non-existent variable', async () => {
			const params = { key: 'NONEXISTENT' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, {
					env: {
						own: {},
						inherited: {}
					}
				});

			let error;
			try {
				await envVarsCommands.deleteEnv({ params, sandbox: true });
			} catch (_error) {
				error = _error;
			}

			expect(error.message).to.equal(`Environment variable 'NONEXISTENT' does not exist at this scope.`);
		});
	});

	describe('scope validation', () => {
		it('throws error when no scope is provided', async () => {
			let error;
			try {
				await envVarsCommands.list({});
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('You must specify one of: --sandbox, --org, --product, or --device');
		});

		it('throws error when multiple scopes are provided', async () => {
			let error;
			try {
				await envVarsCommands.list({ sandbox: true, org: 'my-org' });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('You can only specify one scope at a time. You provided: --sandbox, --org');
		});

		it('throws error when all scopes are provided', async () => {
			let error;
			try {
				await envVarsCommands.setEnvVars({
					params: { key: 'FOO', value: 'bar' },
					sandbox: true,
					org: 'my-org',
					product: 'my-product',
					device: 'abc123'
				});
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('You can only specify one scope at a time. You provided: --sandbox, --org, --product, --device');
		});
	});
});
