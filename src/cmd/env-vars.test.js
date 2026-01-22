'use strict';
const { expect, sinon } = require('../../test/setup');
const { mkdtemp, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const nock = require('nock');
const { sandboxList, sandboxProductList, sandboxDeviceProductList, emptyList, emptyListWithKeys, render } = require('../../test/__fixtures__/env-vars/list');
const EnvVarsCommands = require('./env-vars');


describe('Env Vars Command', () => {
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

	function parseRenderCalls(calls) {
		const output = [];
		const renderValues = calls.filter(line => !line.startsWith('---') && !line.includes('Environment variables:'));
		for (const line of renderValues) {
			const [key, value] = line.split(':');
			output.push({ key: key.trim(), value: value.trim() });
		}
		return output;
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

	describe('unset env vars', () => {
		it('unset env var for sandbox user', async () => {
			let receivedBody;
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1')
				.intercept('/env-vars', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.unsetEnvVars({ params });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Unsetting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully unset.`);
		});

		it('unset env var for specific org', async () => {
			let receivedBody;
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1/orgs/my-org')
				.intercept('/env-vars', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.unsetEnvVars({ params, org: 'my-org' });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Unsetting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully unset.`);
		});
		it('unset env var for specific product', async () => {
			let receivedBody;
			const params = { key: 'FOO' };
			nock('https://api.particle.io/v1/products/my-product')
				.intercept('/env-vars', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.unsetEnvVars({ params, product: 'my-product' });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Unsetting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully unset.`);
		});
		it('unset env var for specific device', async () => {
			let receivedBody;
			const params = { key: 'FOO', value: 'bar' };
			const deviceId = 'abc123';
			nock('https://api.particle.io/v1')
				.intercept(`/env-vars/${deviceId}`, 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.unsetEnvVars({ params, device: deviceId });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Unsetting environment variable...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully unset.`);
		});
	});

	describe('patch env vars', () => {
		it('patch env vars from a file', async () => {
			let receivedBody;
			const tempDir = await mkdtemp(path.join(tmpdir(), 'envvars-test-'));
			const jsonFile = path.join(tempDir, 'file.json');
			const content = {
				ops: [
					{ key: 'FOO', value: 'bar', op: 'set' },
					{ key: 'FOO', value: 'bar', op: 'unset' },
					{ key: 'FOO', value: 'bar', op: 'inherit' },
					{ key: 'FOO', value: 'bar', op: 'unhinerit' },
				]
			};
			const expectedRequest = content.ops.map(env => ({ ...env, access: ['Device'] }));
			await writeFile(jsonFile, JSON.stringify(content, null, 2));

			const params = { filename: jsonFile };
			nock('https://api.particle.io/v1')
				.intercept('/env-vars', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, {}];
				});
			await envVarsCommands.patchEnvVars({ params });
			expect(receivedBody).to.deep.equal({ ops: expectedRequest });
		});
		it('throws an error if the file path is not present or does not exist', async () => {
			const params = { filename: 'my-file.json' };
			let error;
			try {
				await envVarsCommands.patchEnvVars({ params });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.contains('ENOENT: no such file or directory');
		});
		it('throws an error if the file content is not a valid JSON', async() => {
			const tempDir = await mkdtemp(path.join(tmpdir(), 'envvars-test-'));
			const jsonFile = path.join(tempDir, 'wrong-file.json');
			await writeFile(jsonFile, 'no a json file');
			const params = { filename: jsonFile };
			let error;
			try {
				await envVarsCommands.patchEnvVars({ params });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.contains('is not valid JSON');
		});
	});

	describe('render env vars', () => {
		it('renders env vars for sandbox user', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env-vars/render', 'GET')
				.reply(200, render);
			await envVarsCommands.renderEnvVars({});
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			const parsedOutput = parseRenderCalls(writeCalls);
			expect(parsedOutput).to.deep.equal([
				{ key: 'FOO_OTHER', value: 'BAR_other patch' },
				{ key: 'FOO3', value: 'bar3' },
				{ key: 'FOO2', value: 'bar' },
				{ key: 'FOO_PATCH', value: 'BAR_patch' },
				{ key: 'FOO', value: 'bar' },
				{ key: 'FOO_CLI', value: 'bar_CLI' }
			]);
		});
		it('renders env vars as json', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env-vars/render', 'GET')
				.reply(200, render);
			await envVarsCommands.renderEnvVars({ json: true });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			expect(JSON.parse(writeCalls[0])).to.deep.equal(render);
		});
		it('renders env vars for an org', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/orgs/my-org/env-vars/render', 'GET')
				.reply(200, render);
			await envVarsCommands.renderEnvVars({ org: 'my-org', json: true });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			expect(JSON.parse(writeCalls[0])).to.deep.equal(render);
		});
		it('renders env vars for a product', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/products/my-product/env-vars/render', 'GET')
				.reply(200, render);
			await envVarsCommands.renderEnvVars({ product: 'my-product', json: true });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			expect(JSON.parse(writeCalls[0])).to.deep.equal(render);
		});
		it('renders env vars for a device', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/products/my-product/env-vars/my-device-id/render', 'GET')
				.reply(200, render);
			await envVarsCommands.renderEnvVars({ product: 'my-product', device: 'my-device-id', json: true });
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			expect(JSON.parse(writeCalls[0])).to.deep.equal(render);
		});

		it('shows no variables found in case it returns empty', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env-vars/render', 'GET')
				.reply(200, {});
			await envVarsCommands.renderEnvVars({});
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			expect(envVarsCommands.ui.write).to.have.been.calledWith('No environment variables found.');
		});
	});

	describe('rollout', () => {
		const rolloutPreviewData = {
			from_snapshot: {
				changes: [
					{ op: 'Added', key: 'NEW_VAR', after: 'new_value' },
					{ op: 'Removed', key: 'OLD_VAR' },
					{ op: 'Changed', key: 'MOD_VAR', before: 'old_value', after: 'new_mod_value' }
				],
				unchanged: {
					'STATIC_VAR': 'static_value'
				}
			}

		};
		const rolloutSuccessResponse = { success: true };

		beforeEach(() => {
			sinon.stub(envVarsCommands.api, 'getRollout').resolves(rolloutPreviewData);
			sinon.stub(envVarsCommands.api, 'performEnvRollout').resolves(rolloutSuccessResponse);
		});

		it('throws an error if no scope is provided', async () => {
			let error;
			try {
				await envVarsCommands.rollout({});
			} catch (e) {
				error = e;
			}

			expect(error.message).to.equal('Please specify a scope for the rollout: --org, --product, --device, or --sandbox');
		});

		it('throws an error if multiple scopes are provided', async () => {
			let error;
			try {
				await envVarsCommands.rollout({ org: 'my-org', product: 'my-product' });
			} catch (e) {
				error = e;
			}

			expect(error.message).to.equal('The --org, --product, --device, and --sandbox flags are mutually exclusive. Please specify only one.');
		});

		it('displays rollout preview and then perform rollout after confirming', async () => {
			envVarsCommands.ui.prompt.onFirstCall().resolves({ confirm: true }).onSecondCall().resolves({ when: 'Connect' });

			await envVarsCommands.rollout({ product: 'my-product' });

			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Getting environment variable rollout preview...');
			expect(envVarsCommands.api.getRollout).to.have.been.calledWith({ org: undefined, productId: 'my-product', deviceId: undefined });
			expect(envVarsCommands.ui.write.getCalls().map(c => c.args[0])).to.include('Environment Variable Rollout Details:');
			expect(envVarsCommands.ui.write.getCalls().map(c => c.args[0])).to.include(`  ${envVarsCommands.ui.chalk.green('+')} NEW_VAR: new_value`); // Verifying display
			expect(envVarsCommands.ui.prompt).to.have.been.calledWith([
				{
					type: 'confirm',
					name: 'confirm',
					message: 'Are you sure you want to apply these changes to my-product?',
					default: false
				}
			]);
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Applying changes to my-product...');
			expect(envVarsCommands.api.performEnvRollout).to.have.been.calledWith({ org: undefined, productId: 'my-product', deviceId: undefined, when: 'Connect' });
			expect(envVarsCommands.ui.write).to.have.been.calledWith(envVarsCommands.ui.chalk.green('Successfully applied rollout to my-product.'));
		});

		it('displays rollout preview but return if confirmation is denied', async () => {
			envVarsCommands.ui.prompt.resolves({ confirm: false });

			await envVarsCommands.rollout({ product: 'my-product' });

			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Getting environment variable rollout preview...');
			expect(envVarsCommands.api.getRollout).to.have.been.calledWith({ org: undefined, productId: 'my-product', deviceId: undefined });
			expect(envVarsCommands.ui.write.getCalls().map(c => c.args[0])).to.include('Environment Variable Rollout Details:');
			expect(envVarsCommands.ui.prompt).to.have.been.calledOnce;
			expect(envVarsCommands.api.performEnvRollout).to.not.have.been.called; // No POST request if denied
			expect(envVarsCommands.ui.write).to.have.been.calledWith('Rollout cancelled.');
		});

		it('rollouts without confirmation when --yes is passed', async () => {
			await envVarsCommands.rollout({ product: 'my-product', yes: true });

			expect(envVarsCommands.ui.prompt).to.not.have.been.called; // No prompt
			expect(envVarsCommands.api.getRollout).to.have.been.calledWith({ org: undefined, productId: 'my-product', deviceId: undefined });
			expect(envVarsCommands.ui.write.getCalls().map(c => c.args[0])).to.include('Environment Variable Rollout Details:');
			expect(envVarsCommands.api.performEnvRollout).to.have.been.calledWith({ org: undefined, productId: 'my-product', deviceId: undefined, when: 'Connect' });
			expect(envVarsCommands.ui.write).to.have.been.calledWith(envVarsCommands.ui.chalk.green('Successfully applied rollout to my-product.'));
		});

		it('rollouts with specified "when" without prompt when --yes is passed', async () => {
			await envVarsCommands.rollout({ product: 'my-product', yes: true, when: 'Immediate' });

			expect(envVarsCommands.ui.prompt).to.not.have.been.called; // No prompt
			expect(envVarsCommands.api.getRollout).to.have.been.calledWith({ org: undefined, productId: 'my-product', deviceId: undefined });
			expect(envVarsCommands.ui.write.getCalls().map(c => c.args[0])).to.include('Environment Variable Rollout Details:');
			expect(envVarsCommands.api.performEnvRollout).to.have.been.calledWith({ org: undefined, productId: 'my-product', deviceId: undefined, when: 'Immediate' });
			expect(envVarsCommands.ui.write).to.have.been.calledWith(envVarsCommands.ui.chalk.green('Successfully applied rollout to my-product.'));
		});

		it('rollouts to a device', async () => {
			envVarsCommands.ui.prompt.onFirstCall().resolves({ confirm: true }).onSecondCall().resolves({ when: 'Connect' });

			await envVarsCommands.rollout({ device: 'my-device' });

			expect(envVarsCommands.api.getRollout).to.have.been.calledWith({ org: undefined, productId: undefined, deviceId: 'my-device' });
			expect(envVarsCommands.api.performEnvRollout).to.have.been.calledWith({ org: undefined, productId: undefined, deviceId: 'my-device', when: 'Connect' });
			expect(envVarsCommands.ui.write).to.have.been.calledWith(envVarsCommands.ui.chalk.green('Successfully applied rollout to my-device.'));
		});

		it('rollouts to sandbox', async () => {
			envVarsCommands.ui.prompt.onFirstCall().resolves({ confirm: true }).onSecondCall().resolves({ when: 'Immediate' });

			await envVarsCommands.rollout({ sandbox: true });

			expect(envVarsCommands.api.getRollout).to.have.been.calledWith({ org: undefined, productId: undefined, deviceId: undefined });
			expect(envVarsCommands.api.performEnvRollout).to.have.been.calledWith({ org: undefined, productId: undefined, deviceId: undefined, when: 'Immediate' });
			expect(envVarsCommands.ui.write).to.have.been.calledWith(envVarsCommands.ui.chalk.green('Successfully applied rollout to sandbox.'));
		});

		it('handles failed rollout after confirmation', async () => {
			envVarsCommands.ui.prompt.onFirstCall().resolves({ confirm: true }).onSecondCall().resolves({ when: 'Connect' });
			envVarsCommands.api.performEnvRollout.rejects(new Error('API Error: Rollout failed.'));

			let error;
			try {
				await envVarsCommands.rollout({ org: 'my-org' });
			} catch (e) {
				error = e;
			}

			expect(envVarsCommands.api.getRollout).to.have.been.calledWith({ org: 'my-org', productId: undefined, deviceId: undefined });
			expect(envVarsCommands.api.performEnvRollout).to.have.been.calledWith({ org: 'my-org', productId: undefined, deviceId: undefined, when: 'Connect' });
			expect(error.message).to.equal('API Error: Rollout failed.');
		});

		it('displays "No changes to be applied" if getRollout returns empty changes', async () => {
			const emptyRolloutPreview = { from_snapshot: { changes: [], unchanged: { 'STATIC_VAR': 'static_value' } } };
			envVarsCommands.api.getRollout.resolves(emptyRolloutPreview);
			envVarsCommands.ui.prompt.resolves({ confirm: true });

			await envVarsCommands.rollout({ product: 'my-product' });

			expect(envVarsCommands.ui.write).to.have.been.calledWith(envVarsCommands.ui.chalk.gray('No changes to be applied.'));
			expect(envVarsCommands.api.performEnvRollout).to.not.have.been.called;
		});
	});
});
