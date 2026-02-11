'use strict';
const { expect, sinon } = require('../../test/setup');
const nock = require('nock');
const { sandboxList, sandboxProductList, sandboxDeviceProductList, emptyList, emptyListWithKeys } = require('../../test/__fixtures__/env/list');
const EnvCommands = require('./env');
const { displayEnv } = require('../lib/env');


describe('config env Command', () => {
	let envCommands;
	beforeEach(() => {
		envCommands = new EnvCommands();
		envCommands.ui = {
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
		envCommands.ui.chalk.cyan.bold = sinon.stub().callsFake((str) => str);
	});

	afterEach(() => {
		sinon.restore();
	});


	describe('list', () => {
		const { default: stripAnsi } = require('strip-ansi');

		it('list all env vars for sandbox user', async () => {
			// Update fixture to include last_snapshot
			const sandboxListWithSnapshot = {
				...sandboxList,
				last_snapshot: {
					rendered: {
						FOO3: 'bar3',
						FOO2: 'bar',
						FOO: 'bar'
					}
				}
			};

			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, sandboxListWithSnapshot);
			await envCommands.list({ sandbox: true });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// Verify table structure
			expect(tableOutput).to.include('Name');
			expect(tableOutput).to.include('Value');
			expect(tableOutput).to.include('Scope');
			expect(tableOutput).to.include('Overridden');

			// Verify all variables are present
			expect(tableOutput).to.include('FOO3');
			expect(tableOutput).to.include('FOO2');
			expect(tableOutput).to.include('FOO');
			expect(tableOutput).to.include('bar3');
			expect(tableOutput).to.include('bar');

			// All should be Organization scope for sandbox
			const rows = tableOutput.split('\n').filter(line =>
				line.includes('FOO3') || line.includes('FOO2') || line.includes('FOO ')
			);
			rows.forEach(row => {
				expect(row).to.include('Organization');
			});
		});

		it('list all env vars for a product sandbox user', async () => {
			const sandboxProductListWithSnapshot = {
				...sandboxProductList,
				last_snapshot: {
					rendered: {
						FOO3: 'bar3',
						FOO: 'bar'
					}
				}
			};

			nock('https://api.particle.io/v1')
				.intercept('/products/product-id-123/env', 'GET')
				.reply(200, sandboxProductListWithSnapshot);
			await envCommands.list({ product: 'product-id-123' });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// Verify table has the variables
			expect(tableOutput).to.include('FOO3');
			expect(tableOutput).to.include('FOO');
			expect(tableOutput).to.include('bar3');
			expect(tableOutput).to.include('bar');

			// FOO3 should be Product scope and Overridden
			const foo3Row = tableOutput.split('\n').find(line => line.includes('FOO3'));
			expect(foo3Row).to.include('Product');
			expect(foo3Row).to.include('Yes'); // Overridden
		});

		it('list all env vars for a device', async () => {
			const sandboxDeviceProductListWithSnapshot = {
				...sandboxDeviceProductList,
				last_snapshot: {
					rendered: {
						FOO: 'org-bar',
						FOO3: 'bar3',
						FOO4: 'bar'
					}
				}
			};

			nock('https://api.particle.io/v1')
				.intercept('/env/abc123', 'GET')
				.reply(200, sandboxDeviceProductListWithSnapshot);
			await envCommands.list({ device: 'abc123' });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// Verify table includes On Device column for device scope
			expect(tableOutput).to.include('On Device');
			expect(tableOutput).to.include('FOO');
			expect(tableOutput).to.include('org-bar');
		});

		it('show message for empty list', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, emptyList);
			await envCommands.list({ sandbox: true });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			expect(envCommands.ui.write).to.have.been.calledWith('No environment variables found.');
		});

		it('show message for empty list but existing objects', async () => {
			nock('https://api.particle.io/v1')
				.intercept('/env', 'GET')
				.reply(200, emptyListWithKeys);
			await envCommands.list({ sandbox: true });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving environment variables...');
			expect(envCommands.ui.write).to.have.been.calledWith('No environment variables found.');
		});
	});
	describe('set env vars', () => {
		it('set env var for sandbox user', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envCommands.setEnv({ params, sandbox: true });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});

		it('throws an error in case the key, value is invalid', async () => {
			const apiError = {
				error_description: 'Validation error: : Must only contain uppercase letters, numbers, and underscores. Must not start with a number. at "ops[0].key"',
				error:'invalid_request'
			};
			const params = { key: 'invalid-key', value: 'bar' }; // Invalid key with dash
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply(400, apiError);
			let error;
			try {
				await envCommands.setEnv({ params, sandbox: true });
			} catch (_error) {
				error = _error;
			}
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(error.message).to.contains(apiError.error_description);
		});
		it('set env var for specific org', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1/orgs/my-org')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envCommands.setEnv({ params, org: 'my-org' });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});
		it('set env var for specific product', async () => {
			const params = { key: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1/products/my-product')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envCommands.setEnv({ params, product: 'my-product' });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});
		it('set env var for specific device', async () => {
			const params = { key: 'FOO', value: 'bar' };
			const deviceId = 'abc123';

			// Stub API methods for displayRolloutInstructions
			sinon.stub(envCommands.api, 'getDevice').resolves({
				body: { id: deviceId, product_id: 12345 }
			});
			sinon.stub(envCommands.api, 'getProduct').resolves({
				product: { slug: 'my-product' }
			});

			nock('https://api.particle.io/v1')
				.intercept(`/env/${deviceId}`, 'PATCH')
				.reply(200, sandboxList);
			await envCommands.setEnv({ params, device: deviceId });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully set.`);
		});

		it('set env var using key=value format', async () => {
			let receivedBody;
			const params = { key: 'FOO=bar' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, sandboxList];
				});
			await envCommands.setEnv({ params, sandbox: true });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', value: 'bar', op: 'Set' }] });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith('Key FOO has been successfully set.');
		});

		it('set env var using key=value format with value containing equals sign', async () => {
			let receivedBody;
			const params = { key: 'FOO=bar=baz' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, sandboxList];
				});
			await envCommands.setEnv({ params, sandbox: true });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', value: 'bar=baz', op: 'Set' }] });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith('Key FOO has been successfully set.');
		});

		it('throws error when key=value format is invalid (empty key)', async () => {
			const params = { key: '=bar' };
			let error;
			try {
				await envCommands.setEnv({ params, sandbox: true });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('Invalid format. Use either "key value" or "key=value"');
		});

		it('throws error when neither key/value nor key=value format is provided', async () => {
			const params = { key: 'FOO' }; // Missing value
			let error;
			try {
				await envCommands.setEnv({ params, sandbox: true });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('Invalid format. Use either "key value" or "key=value"');
		});
	});

	describe('delete env vars', () => {
		it('deletes env var for sandbox user', async () => {
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
			await envCommands.deleteEnv({ params, sandbox: true });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});

		it('deletes env var for specific org', async () => {
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
			await envCommands.deleteEnv({ params, org: 'my-org' });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});

		it('deletes env var for specific product', async () => {
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
			await envCommands.deleteEnv({ params, product: 'my-product' });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
		});

		it('deletes env var for specific device', async () => {
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
			await envCommands.deleteEnv({ params, device: deviceId });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', op: 'Unset' }] });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Deleting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
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

			await envCommands.deleteEnv({ params, sandbox: true });

			expect(envCommands.ui.write).to.have.been.calledWith(
				envCommands.ui.chalk.yellow(`Warning: 'INHERITED_VAR' is inherited from a parent scope and cannot be deleted at this level.`)
			);
			expect(envCommands.ui.showBusySpinnerUntilResolved).not.to.have.been.called;
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

			await envCommands.deleteEnv({ params, sandbox: true });

			expect(envCommands.ui.write).to.have.been.calledWith(
				envCommands.ui.chalk.yellow(`Note: 'FOO' is an overridden variable. If you delete it, the inherited value 'inherited_value' will become visible.`)
			);
			expect(envCommands.ui.write).to.have.been.calledWith(`Key ${params.key} has been successfully deleted.`);
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

			await envCommands.deleteEnv({ params, sandbox: true, dryRun: true });

			expect(envCommands.ui.write).to.have.been.calledWith(
				envCommands.ui.chalk.cyan(`[DRY RUN] Would delete environment variable 'FOO'`)
			);
			expect(envCommands.ui.write).to.have.been.calledWith('Current value: bar');
			expect(envCommands.ui.showBusySpinnerUntilResolved).not.to.have.been.called;
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

			await envCommands.deleteEnv({ params, sandbox: true, dryRun: true });

			expect(envCommands.ui.write).to.have.been.calledWith(
				envCommands.ui.chalk.yellow(`Note: 'FOO' is an overridden variable. If you delete it, the inherited value 'inherited_value' will become visible.`)
			);
			expect(envCommands.ui.write).to.have.been.calledWith(
				envCommands.ui.chalk.cyan(`[DRY RUN] Would delete environment variable 'FOO'`)
			);
			expect(envCommands.ui.showBusySpinnerUntilResolved).not.to.have.been.called;
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
				await envCommands.deleteEnv({ params, sandbox: true });
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
				await envCommands.list({});
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('You must specify one of: --sandbox, --org, --product, or --device');
		});

		it('throws error when multiple scopes are provided', async () => {
			let error;
			try {
				await envCommands.list({ sandbox: true, org: 'my-org' });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('You can only specify one scope at a time. You provided: --sandbox, --org');
		});

		it('throws error when all scopes are provided', async () => {
			let error;
			try {
				await envCommands.setEnv({
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

	describe('_displayEnv table rendering', () => {
		const { default: stripAnsi } = require('strip-ansi');

		it('displays product scope with inherited variables from organization', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'baz-prod',
						BAZ: 'foo',
						KEY: 'value'
					},
					rollout_at: '2026-02-09T17:47:17.121Z',
					rollout_by: '60468db2509eb004820e11e0'
				},
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'test/data' },
						BAZ: { from: 'Owner', value: 'foo' },
						KEY: { from: 'Owner', value: 'value' }
					},
					own: {
						FOO: { value: 'baz-prod' }
					}
				}
			};

			await displayEnv(data, { product: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			expect(tableOutput).to.include('Name');
			expect(tableOutput).to.include('Value');
			expect(tableOutput).to.include('Scope');
			expect(tableOutput).to.include('Overridden');
			expect(tableOutput).to.include('BAZ');
			expect(tableOutput).to.include('foo');
			expect(tableOutput).to.include('Organization');
			expect(tableOutput).to.include('FOO');
			expect(tableOutput).to.include('baz-prod');
			expect(tableOutput).to.include('Product');
			expect(tableOutput).to.include('KEY');
			expect(tableOutput).to.include('value');

			// Check that FOO shows as overridden (Yes) because it's in both own and inherited and applied
			const fooRow = tableOutput.split('\n').find(line => line.includes('FOO'));
			expect(fooRow).to.include('Yes');

			// Check that BAZ shows as not overridden (No)
			const bazRow = tableOutput.split('\n').find(line => line.includes('BAZ'));
			expect(bazRow).to.include('No');
		});

		it('displays product scope with pending changes and shows warning', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'baz-prod',
						BAZ: 'foo',
						KEY: 'value'
					}
				},
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'test/data' },
						BAZ: { from: 'Owner', value: 'foo' },
						KEY: { from: 'Owner', value: 'value' }
					},
					own: {
						FOO: { value: 'baz-prod' },
						BAZ: { value: 'product' }
					}
				}
			};

			await displayEnv(data, { product: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// BAZ should show 'foo' (from snapshot), not 'product' (from own)
			const bazRow = tableOutput.split('\n').find(line => line.includes('BAZ'));
			expect(bazRow).to.include('foo');
			expect(bazRow).to.not.include('product');

			// BAZ should show as not overridden because change is pending
			expect(bazRow).to.include('No');

			// Should show rollout instructions
			expect(writeCalls.join('\n')).to.include('Changes have been saved successfully');
			expect(writeCalls.join('\n')).to.include('To apply these changes, you need to perform a rollout');
		});

		it('does not show pending variables not in last_snapshot', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'test/data',
						BAZ: 'foo',
						KEY: 'value'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'test/data' },
						BAZ: { value: 'foo' },
						KEY: { value: 'value' },
						NEW: { value: 'set' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// Should NOT show NEW variable
			expect(tableOutput).to.not.include('NEW');
			expect(tableOutput).to.not.include('set');

			// Should show the three that are in last_snapshot
			expect(tableOutput).to.include('FOO');
			expect(tableOutput).to.include('BAZ');
			expect(tableOutput).to.include('KEY');

			// Should show rollout instructions
			expect(writeCalls.join('\n')).to.include('Changes have been saved successfully');
			expect(writeCalls.join('\n')).to.include('To apply these changes, you need to perform a rollout');
		});

		it('displays device scope with on_device column showing missing when null', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'baz-prod',
						BAZ: 'foo',
						KEY: 'value'
					}
				},
				env: {
					inherited: {
						FOO: { from: 'Product', value: 'baz-prod' },
						BAZ: { from: 'Owner', value: 'foo' },
						KEY: { from: 'Owner', value: 'value' }
					},
					own: {}
				},
				on_device: null
			};

			await displayEnv(data, { device: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// Should have On Device column
			expect(tableOutput).to.include('On Device');

			// All should show 'missing' since on_device is null
			const rows = tableOutput.split('\n').filter(line => line.includes('│'));
			const dataRows = rows.slice(2); // Skip header rows
			dataRows.forEach(row => {
				if (row.includes('FOO') || row.includes('BAZ') || row.includes('KEY')) {
					expect(row).to.include('missing');
				}
			});

			// Check scope based on 'from' field
			const fooRow = tableOutput.split('\n').find(line => line.includes('FOO'));
			expect(fooRow).to.include('Product');

			const bazRow = tableOutput.split('\n').find(line => line.includes('BAZ'));
			expect(bazRow).to.include('Organization');
		});

		it('displays device scope with on_device values when provided', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'baz-prod',
						BAZ: 'foo',
						KEY: 'value'
					}
				},
				env: {
					inherited: {
						FOO: { from: 'Product', value: 'baz-prod' },
						BAZ: { from: 'Owner', value: 'foo' },
						KEY: { from: 'Owner', value: 'value' }
					},
					own: {}
				},
				on_device: {
					FOO: 'old-value',
					BAZ: 'bar'
				}
			};

			await displayEnv(data, { device: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// Should show on_device values
			const fooRow = tableOutput.split('\n').find(line => line.includes('FOO'));
			expect(fooRow).to.include('old-value');

			const bazRow = tableOutput.split('\n').find(line => line.includes('BAZ'));
			expect(bazRow).to.include('bar');

			// KEY should show 'missing' since it's not in on_device
			const keyRow = tableOutput.split('\n').find(line => line.includes('KEY'));
			expect(keyRow).to.include('missing');
		});

		it('does not show on_device column for product scope', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'baz-prod'
					}
				},
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'test/data' }
					},
					own: {
						FOO: { value: 'baz-prod' }
					}
				}
			};

			await displayEnv(data, { product: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// Should NOT have On Device column
			expect(tableOutput).to.not.include('On Device');

			// Should have Name, Value, Scope, Overridden
			expect(tableOutput).to.include('Name');
			expect(tableOutput).to.include('Value');
			expect(tableOutput).to.include('Scope');
			expect(tableOutput).to.include('Overridden');
		});

		it('shows all scopes as Organization for sandbox', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'test/data',
						BAZ: 'foo',
						KEY: 'value'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'test/data' },
						BAZ: { value: 'foo' },
						KEY: { value: 'value' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// All variables should show Organization scope
			const rows = tableOutput.split('\n').filter(line =>
				line.includes('FOO') || line.includes('BAZ') || line.includes('KEY')
			);
			rows.forEach(row => {
				expect(row).to.include('Organization');
			});
		});

		it('displays empty state when no variables exist', async () => {
			const data = {
				last_snapshot: { rendered: {} },
				env: {
					inherited: {},
					own: {}
				}
			};

			await displayEnv(data, { sandbox: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => c.args[0]);
			expect(writeCalls[0]).to.equal('No environment variables found.');
		});

		it('sorts variables alphabetically', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						ZEBRA: 'z',
						APPLE: 'a',
						BANANA: 'b'
					}
				},
				env: {
					inherited: {
						ZEBRA: { from: 'Owner', value: 'z' },
						APPLE: { from: 'Owner', value: 'a' },
						BANANA: { from: 'Owner', value: 'b' }
					},
					own: {}
				}
			};

			await displayEnv(data, { sandbox: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[0];

			// Find the order of variables in the output
			const appleIndex = tableOutput.indexOf('APPLE');
			const bananaIndex = tableOutput.indexOf('BANANA');
			const zebraIndex = tableOutput.indexOf('ZEBRA');

			// Should be alphabetically sorted: APPLE < BANANA < ZEBRA
			expect(appleIndex).to.be.lessThan(bananaIndex);
			expect(bananaIndex).to.be.lessThan(zebraIndex);
		});
	});
});
