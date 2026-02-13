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

		envCommands.ui.chalk.cyan.bold = sinon.stub().callsFake((str) => str);
		envCommands.ui.chalk.yellow.bold = sinon.stub().callsFake((str) => str);
	});

	afterEach(() => {
		sinon.restore();
	});


	describe('list', () => {
		const { default: stripAnsi } = require('strip-ansi');

		it('list all env vars for sandbox user', async () => {
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
			const tableOutput = writeCalls[2];

			expect(tableOutput).to.include('Name');
			expect(tableOutput).to.include('Value');
			expect(tableOutput).to.include('Scope');
			expect(tableOutput).to.include('Overridden');
			expect(tableOutput).to.include('FOO3');
			expect(tableOutput).to.include('FOO2');
			expect(tableOutput).to.include('FOO');
			expect(tableOutput).to.include('bar3');
			expect(tableOutput).to.include('bar');
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
			const tableOutput = writeCalls[2];

			expect(tableOutput).to.include('FOO3');
			expect(tableOutput).to.include('FOO');
			expect(tableOutput).to.include('bar3');
			expect(tableOutput).to.include('bar');
			const foo3Row = tableOutput.split('\n').find(line => line.includes('FOO3'));
			expect(foo3Row).to.include('Product');
			expect(foo3Row).to.include('Yes');
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
			const tableOutput = writeCalls[2];

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
			const params = { name: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envCommands.setEnv({ params, sandbox: true });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully set.`);
		});

		it('throws an error in case the name, value is invalid', async () => {
			const apiError = {
				error_description: 'Validation error: : Must only contain uppercase letters, numbers, and underscores. Must not start with a number. at "ops[0].key"',
				error:'invalid_request'
			};
			const params = { name: 'invalid-key', value: 'bar' };
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
			const params = { name: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1/orgs/my-org')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envCommands.setEnv({ params, org: 'my-org' });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully set.`);
		});
		it('set env var for specific product', async () => {
			const params = { name: 'FOO', value: 'bar' };
			nock('https://api.particle.io/v1/products/my-product')
				.intercept('/env', 'PATCH')
				.reply(200, sandboxList);
			await envCommands.setEnv({ params, product: 'my-product' });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully set.`);
		});
		it('set env var for specific device', async () => {
			const params = { name: 'FOO', value: 'bar' };
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
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully set.`);
		});

		it('set env var using key=value format', async () => {
			let receivedBody;
			const params = { name: 'FOO=bar' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, sandboxList];
				});
			await envCommands.setEnv({ params, sandbox: true });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', value: 'bar', op: 'Set' }] });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith('Environment variable FOO has been successfully set.');
		});

		it('set env var using key=value format with value containing equals sign', async () => {
			let receivedBody;
			const params = { name: 'FOO=bar=baz' };
			nock('https://api.particle.io/v1')
				.intercept('/env', 'PATCH')
				.reply((uri, requestBody) => {
					receivedBody = requestBody;
					return [200, sandboxList];
				});
			await envCommands.setEnv({ params, sandbox: true });
			expect(receivedBody).to.deep.equal({ ops: [{ key: 'FOO', value: 'bar=baz', op: 'Set' }] });
			expect(envCommands.ui.showBusySpinnerUntilResolved).calledWith('Setting environment variable...');
			expect(envCommands.ui.write).to.have.been.calledWith('Environment variable FOO has been successfully set.');
		});

		it('throws error when key=value format is invalid (empty key)', async () => {
			const params = { name: '=bar' };
			let error;
			try {
				await envCommands.setEnv({ params, sandbox: true });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('Invalid format. Use either "name value" or "name=value"');
		});

		it('throws error when neither key/value nor key=value format is provided', async () => {
			const params = { name: 'FOO' }; // Missing value
			let error;
			try {
				await envCommands.setEnv({ params, sandbox: true });
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('Invalid format. Use either "name value" or "name=value"');
		});
	});

	describe('delete env vars', () => {
		it('deletes env var for sandbox user', async () => {
			let receivedBody;
			const params = { name: 'FOO' };
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
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully deleted.`);
		});

		it('deletes env var for specific org', async () => {
			let receivedBody;
			const params = { name: 'FOO' };
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
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully deleted.`);
		});

		it('deletes env var for specific product', async () => {
			let receivedBody;
			const params = { name: 'FOO' };
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
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully deleted.`);
		});

		it('deletes env var for specific device', async () => {
			let receivedBody;
			const params = { name: 'FOO', value: 'bar' };
			const deviceId = 'abc123';
			sinon.stub(envCommands.api, 'getDevice').resolves({
				body: { id: deviceId, product_id: 12345 }
			});
			sinon.stub(envCommands.api, 'getProduct').resolves({
				product: { slug: 'my-product' }
			});

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
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully deleted.`);
		});

		it('prevents deletion of inherited-only variables', async () => {
			const params = { name: 'INHERITED_VAR' };
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
			const params = { name: 'FOO' };
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
			expect(envCommands.ui.write).to.have.been.calledWith(`Environment variable ${params.name} has been successfully deleted.`);
		});

		it('throws error when trying to delete non-existent variable', async () => {
			const params = { name: 'NONEXISTENT' };
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
					params: { name: 'FOO', value: 'bar' },
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
			const tableOutput = writeCalls[2];

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
			const fooRow = tableOutput.split('\n').find(line => line.includes('FOO'));
			expect(fooRow).to.include('Yes');
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
			const tableOutput = writeCalls[2];
			const bazRow = tableOutput.split('\n').find(line => line.includes('BAZ'));
			expect(bazRow).to.include('foo');
			expect(bazRow).to.not.include('product');
			expect(bazRow).to.include('No');
			expect(writeCalls.join('\n')).to.include('There are pending changes that have not been applied yet.');
			expect(writeCalls.join('\n')).to.include('To review and save this changes in the console');
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
			const tableOutput = writeCalls[2];
			expect(tableOutput).to.not.include('NEW');
			expect(tableOutput).to.not.include('set');
			expect(tableOutput).to.include('FOO');
			expect(tableOutput).to.include('BAZ');
			expect(tableOutput).to.include('KEY');
			expect(writeCalls.join('\n')).to.include('There are pending changes that have not been applied yet.');
			expect(writeCalls.join('\n')).to.include('To review and save this changes in the console');
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
			const tableOutput = writeCalls[2];
			expect(tableOutput).to.include('On Device');
			const rows = tableOutput.split('\n').filter(line => line.includes('│'));
			const dataRows = rows.slice(2);
			dataRows.forEach(row => {
				if (row.includes('FOO') || row.includes('BAZ') || row.includes('KEY')) {
					expect(row).to.include('missing');
				}
			});
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
					rendered: {
						FOO: 'old-value',
						BAZ: 'bar'
					}
				}
			};

			await displayEnv(data, { device: true }, envCommands.ui);

			const writeCalls = envCommands.ui.write.getCalls().map(c => stripAnsi(c.args[0]));
			const tableOutput = writeCalls[2];
			const fooRow = tableOutput.split('\n').find(line => line.includes('FOO'));
			expect(fooRow).to.include('old-value');

			const bazRow = tableOutput.split('\n').find(line => line.includes('BAZ'));
			expect(bazRow).to.include('bar');

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
			const tableOutput = writeCalls[2];
			expect(tableOutput).to.not.include('On Device');
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
			const tableOutput = writeCalls[2];
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
			expect(writeCalls.join('\n')).to.include('No environment variables found.');
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
			const tableOutput = writeCalls[2];
			const appleIndex = tableOutput.indexOf('APPLE');
			const bananaIndex = tableOutput.indexOf('BANANA');
			const zebraIndex = tableOutput.indexOf('ZEBRA');
			expect(appleIndex).to.be.lessThan(bananaIndex);
			expect(bananaIndex).to.be.lessThan(zebraIndex);
		});
	});
});
