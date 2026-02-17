'use strict';
const { expect, sinon } = require('../../test/setup');
const {
	getSortedEnvKeys,
	calculateColumnWidths,
	buildEnvTable,
	displayScopeTitle,
	displayEnv,
	displayRolloutInstructions
} = require('./env');

describe('lib/env', () => {
	describe('getSortedEnvKeys', () => {
		it('returns sorted keys from last_snapshot.own and last_snapshot.inherited', () => {
			const data = {
				last_snapshot: {
					own: {
						ZEBRA: { value: 'z' },
						APPLE: { value: 'a' }
					},
					inherited: {
						BANANA: { value: 'b', from: 'Owner' }
					}
				}
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal(['APPLE', 'BANANA', 'ZEBRA']);
		});

		it('includes on_device keys in the result', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				},
				on_device: {
					rendered: {
						FOO: 'bar',
						DEVICE_ONLY: 'val'
					}
				}
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal(['DEVICE_ONLY', 'FOO']);
		});

		it('returns unique keys when keys exist in multiple sources', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {
						FOO: { value: 'inherited', from: 'Owner' },
						BAZ: { value: 'qux', from: 'Owner' }
					}
				},
				on_device: {
					rendered: {
						FOO: 'bar'
					}
				}
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal(['BAZ', 'FOO']);
		});

		it('returns empty array when no keys exist', () => {
			const data = {
				last_snapshot: {
					own: {},
					inherited: {}
				}
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal([]);
		});

		it('handles missing last_snapshot', () => {
			const data = {};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal([]);
		});
	});

	describe('calculateColumnWidths', () => {
		it('calculates widths based on content', () => {
			const tableRows = [
				{ key: 'SHORT', onDeviceValue: 'missing', value: 'val', scope: 'Owner', isOverriden: 'No' },
				{ key: 'VERY_LONG_VARIABLE_NAME', onDeviceValue: 'missing', value: 'this is a very long value', scope: 'Owner', isOverriden: 'No' }
			];

			const result = calculateColumnWidths(tableRows);

			expect(result['Name']).to.be.at.least('VERY_LONG_VARIABLE_NAME'.length + 2);
			expect(result['Value']).to.be.at.least('this is a very long value'.length + 2);
		});

		it('sets minimum widths based on column headers', () => {
			const tableRows = [];
			const result = calculateColumnWidths(tableRows);

			expect(result['Name']).to.be.at.least('Name'.length + 2);
			expect(result['On Device']).to.be.at.least('On Device'.length + 2);
			expect(result['Value']).to.be.at.least('Value'.length + 2);
			expect(result['Scope']).to.be.at.least('Scope'.length + 2);
			expect(result['Overridden']).to.be.at.least('Overridden'.length + 2);
		});

		it('accounts for on device values in column width', () => {
			const tableRows = [
				{ key: 'FOO', onDeviceValue: 'very-long-on-device-value', value: 'bar', scope: 'Device', isOverriden: 'No' }
			];

			const result = calculateColumnWidths(tableRows);

			expect(result['On Device']).to.be.at.least('very-long-on-device-value'.length + 2);
		});

		it('accounts for scope values in column width', () => {
			const tableRows = [
				{ key: 'FOO', onDeviceValue: 'missing', value: 'bar', scope: 'Organization', isOverriden: 'No' }
			];

			const result = calculateColumnWidths(tableRows);

			expect(result['Scope']).to.be.at.least('Organization'.length + 2);
		});
	});

	describe('buildEnvTable', () => {
		it('builds a table with proper structure for sandbox scope', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			expect(output).to.include('Name');
			expect(output).to.include('Value');
			expect(output).to.include('Scope');
			expect(output).to.include('Overridden');
			expect(output).to.include('FOO');
			expect(output).to.include('bar');
			expect(output).to.include('Owner');
		});

		it('shows scope from inherited "from" field', () => {
			const data = {
				last_snapshot: {
					own: {},
					inherited: {
						FOO: { value: 'bar', from: 'Firmware' }
					}
				}
			};

			const table = buildEnvTable(data, { device: 'my-device' });
			const output = table.toString();

			expect(output).to.include('Firmware');
		});

		it('shows overridden as Yes when key exists in both own and inherited', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'override-value' }
					},
					inherited: {
						FOO: { value: 'original', from: 'Owner' }
					}
				}
			};

			const table = buildEnvTable(data, { product: 'my-product' });
			const output = table.toString();

			expect(output).to.include('Yes');
		});

		it('shows overridden as No when key is only in own', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			expect(output).to.include('No');
		});

		it('uses "Owner" as scope for own variables in sandbox/org scope', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			expect(output).to.include('Owner');
		});

		it('uses "Product" as scope for own variables in product scope', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { product: 'my-product' });
			const output = table.toString();

			expect(output).to.include('Product');
		});

		it('uses "Device" as scope for own variables in device scope', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { device: 'my-device' });
			const output = table.toString();

			expect(output).to.include('Device');
		});

		it('includes On Device column for device scope', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				},
				on_device: {
					rendered: { FOO: 'device-val' }
				}
			};

			const table = buildEnvTable(data, { device: 'my-device' });
			const output = table.toString();

			expect(output).to.include('On Device');
			expect(output).to.include('device-val');
		});

		it('does not include On Device column for non-device scopes', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			expect(output).to.not.include('On Device');
		});

		it('shows "missing" for on_device when value is not present', () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				},
				on_device: {
					rendered: {}
				}
			};

			const table = buildEnvTable(data, { device: 'my-device' });
			const output = table.toString();

			expect(output).to.include('missing');
		});

		it('sorts variables alphabetically', () => {
			const data = {
				last_snapshot: {
					own: {
						ZEBRA: { value: 'z' },
						APPLE: { value: 'a' },
						BANANA: { value: 'b' }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			const appleIndex = output.indexOf('APPLE');
			const bananaIndex = output.indexOf('BANANA');
			const zebraIndex = output.indexOf('ZEBRA');

			expect(appleIndex).to.be.lessThan(bananaIndex);
			expect(bananaIndex).to.be.lessThan(zebraIndex);
		});

		it('handles very long environment variable names without truncation', () => {
			const longName = 'VERY_LONG_ENVIRONMENT_VARIABLE_NAME_THAT_EXCEEDS_TYPICAL_LENGTH';
			const data = {
				last_snapshot: {
					own: {
						[longName]: { value: 'value' }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			expect(output).to.include(longName);
			expect(output).to.not.include('...');
		});

		it('handles very long environment variable values without truncation', () => {
			const longValue = 'var_too_long_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890';
			const data = {
				last_snapshot: {
					own: {
						API_KEY: { value: longValue }
					},
					inherited: {}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			expect(output).to.include(longValue);
		});

		it('handles long on_device values for device scope without truncation', () => {
			const longOnDeviceValue = 'on-device-value-that-is-extremely-long-and-should-not-be-truncated-123456789';
			const data = {
				last_snapshot: {
					own: {
						CONFIG: { value: 'bar' }
					},
					inherited: {}
				},
				on_device: {
					rendered: { CONFIG: longOnDeviceValue }
				}
			};

			const table = buildEnvTable(data, { device: 'my-device' });
			const output = table.toString();

			expect(output).to.include(longOnDeviceValue);
			expect(output).to.include('On Device');
		});
	});

	describe('displayEnv', () => {
		let ui;

		beforeEach(() => {
			ui = {
				_writes: [],
				write: function(str) {
					this._writes.push(str);
				},
				chalk: {
					yellow: (str) => str,
					cyan: (str) => str,
					bold: (str) => str,
					green: (str) => str
				}
			};
			ui.chalk.cyan.bold = (str) => str;
			ui.chalk.yellow.bold = (str) => str;
		});

		it('displays table when variables exist', async () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				},
				env: {
					own: {
						FOO: { value: 'different' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('Scope: Sandbox');
			expect(output).to.include('FOO');
			expect(output).to.include('bar');
		});

		it('displays "No environment variables found" when empty', async () => {
			const data = {
				last_snapshot: {
					own: {},
					inherited: {}
				},
				env: {
					own: {}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('Scope: Sandbox');
			expect(output).to.include('No environment variables found.');
		});

		it('displays pending changes warning when last_snapshot.own differs from env.own', async () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'old-value' }
					},
					inherited: {}
				},
				env: {
					own: {
						FOO: { value: 'new-value' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('There are pending changes that have not been applied yet.');
		});

		it('does not display pending changes warning when last_snapshot.own equals env.own', async () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'bar' }
					},
					inherited: {}
				},
				env: {
					own: {
						FOO: { value: 'bar' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.not.include('There are pending changes that have not been applied yet.');
		});

		it('displays rollout URL for sandbox when pending changes exist', async () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'old-value' }
					},
					inherited: {}
				},
				env: {
					own: {
						FOO: { value: 'new-value' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('https://console.particle.io/env/edit');
		});

		it('displays rollout URL for product when pending changes exist', async () => {
			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'old-value' }
					},
					inherited: {}
				},
				env: {
					own: {
						FOO: { value: 'new-value' }
					}
				}
			};

			await displayEnv(data, { product: '12345' }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('https://console.particle.io/12345/env/edit');
		});

		it('displays device rollout URL when pending changes exist and device has product', async () => {
			const mockApi = {
				getDevice: sinon.stub().resolves({
					body: {
						id: 'device123',
						product_id: 99999
					}
				}),
				getProduct: sinon.stub().resolves({
					product: {
						slug: 'my-product'
					}
				}),
				accessToken: 'test-token'
			};

			const data = {
				last_snapshot: {
					own: {
						FOO: { value: 'old-value' }
					},
					inherited: {}
				},
				env: {
					own: {
						FOO: { value: 'new-value' }
					}
				}
			};

			await displayEnv(data, { device: 'device123' }, ui, mockApi);

			const output = ui._writes.join('\n');
			expect(output).to.include('https://console.particle.io/my-product/devices/device123');
		});
	});

	describe('displayScopeTitle', () => {
		let ui;

		beforeEach(() => {
			ui = {
				_writes: [],
				write: function(str) {
					this._writes.push(str);
				},
				chalk: {
					bold: (str) => str
				}
			};
		});

		it('displays "Scope: Sandbox" for sandbox scope', async () => {
			await displayScopeTitle({ sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('Scope: Sandbox');
		});

		it('displays "Scope: Organization (org-slug)" for org scope', async () => {
			await displayScopeTitle({ org: 'my-org' }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('Scope: Organization (my-org)');
		});

		it('displays "Scope: Product (product-id)" for product scope without api', async () => {
			await displayScopeTitle({ product: '12345' }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('Scope: Product (12345)');
		});

		it('displays "Scope: Product (product-name)" for product scope with api', async () => {
			const mockApi = {
				getProduct: sinon.stub().resolves({
					product: {
						name: 'My Product'
					}
				}),
				accessToken: 'test-token'
			};

			await displayScopeTitle({ product: '12345' }, ui, mockApi);

			expect(mockApi.getProduct).to.have.been.calledWith({
				product: '12345',
				auth: 'test-token'
			});

			const output = ui._writes.join('\n');
			expect(output).to.include('Scope: Product (My Product)');
		});

		it('displays "Scope: Product (product-id)" when api fails to get product name', async () => {
			const mockApi = {
				getProduct: sinon.stub().rejects(new Error('API error')),
				accessToken: 'test-token'
			};

			await displayScopeTitle({ product: '12345' }, ui, mockApi);

			const output = ui._writes.join('\n');
			expect(output).to.include('Scope: Product (12345)');
		});

		it('displays "Scope: Device (device-id)" for device scope', async () => {
			await displayScopeTitle({ device: 'abc123' }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('Scope: Device (abc123)');
		});
	});

	describe('displayRolloutInstructions', () => {
		let ui;

		beforeEach(() => {
			ui = {
				_writes: [],
				write: function(str) {
					this._writes.push(str);
				},
				chalk: {
					green: (str) => str,
					yellow: (str) => str,
					cyan: (str) => str
				}
			};
		});

		it('displays sandbox rollout URL', async () => {
			await displayRolloutInstructions({ sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('To review and save these changes in the Console, visit:');
			expect(output).to.include('https://console.particle.io/env/edit');
		});

		it('displays org rollout URL', async () => {
			await displayRolloutInstructions({ org: 'my-org' }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('To review and save these changes in the Console, visit:');
			expect(output).to.include('https://console.particle.io/orgs/my-org/env/edit');
		});

		it('displays product rollout URL', async () => {
			await displayRolloutInstructions({ product: '12345' }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('To review and save these changes in the Console, visit:');
			expect(output).to.include('https://console.particle.io/12345/env/edit');
		});

		it('displays device URL with product slug when device is in a product', async () => {
			const mockApi = {
				getDevice: sinon.stub().resolves({
					body: {
						id: 'device123',
						product_id: 99999
					}
				}),
				getProduct: sinon.stub().resolves({
					product: {
						slug: 'my-product'
					}
				}),
				accessToken: 'test-token'
			};

			await displayRolloutInstructions({ device: 'device123' }, ui, mockApi);

			expect(mockApi.getDevice).to.have.been.calledWith({
				deviceId: 'device123',
				auth: 'test-token'
			});

			expect(mockApi.getProduct).to.have.been.calledWith({
				product: 99999,
				auth: 'test-token'
			});

			const output = ui._writes.join('\n');
			expect(output).to.include('To review and save these changes in the Console, visit:');
			expect(output).to.include('https://console.particle.io/my-product/devices/device123');
		});

		it('displays device URL without product slug when product has no slug', async () => {
			const mockApi = {
				getDevice: sinon.stub().resolves({
					body: {
						id: 'device456'
					}
				}),
				getProduct: sinon.stub().resolves({
					product: null
				}),
				accessToken: 'test-token'
			};

			await displayRolloutInstructions({ device: 'device456' }, ui, mockApi);

			expect(mockApi.getDevice).to.have.been.calledWith({
				deviceId: 'device456',
				auth: 'test-token'
			});

			const output = ui._writes.join('\n');
			expect(output).to.include('To review and save these changes in the Console, visit:');
			expect(output).to.include('https://console.particle.io/devices/device456');
		});

		it('throws error when api is not provided for device scope', async () => {
			let error;
			try {
				await displayRolloutInstructions({ device: 'device123' }, ui);
			} catch (e) {
				error = e;
			}

			expect(error).to.exist;
			expect(error.message).to.equal('API instance is required to get device information');
		});

		describe('staging environment', () => {
			const settings = require('../../settings');

			afterEach(() => {
				sinon.restore();
			});

			it('uses staging console URL for sandbox when isStaging is true', async () => {
				sinon.stub(settings, 'isStaging').value(true);

				await displayRolloutInstructions({ sandbox: true }, ui);

				const output = ui._writes.join('\n');
				expect(output).to.include('https://console.staging.particle.io/env/edit');
			});

			it('uses staging console URL for org when isStaging is true', async () => {
				sinon.stub(settings, 'isStaging').value(true);

				await displayRolloutInstructions({ org: 'my-org' }, ui);

				const output = ui._writes.join('\n');
				expect(output).to.include('https://console.staging.particle.io/orgs/my-org/env/edit');
			});

			it('uses staging console URL for product when isStaging is true', async () => {
				sinon.stub(settings, 'isStaging').value(true);

				await displayRolloutInstructions({ product: '12345' }, ui);

				const output = ui._writes.join('\n');
				expect(output).to.include('https://console.staging.particle.io/12345/env/edit');
			});

			it('uses staging console URL for device when isStaging is true', async () => {
				sinon.stub(settings, 'isStaging').value(true);

				const mockApi = {
					getDevice: sinon.stub().resolves({
						body: {
							id: 'device123',
							product_id: 99999
						}
					}),
					getProduct: sinon.stub().resolves({
						product: {
							slug: 'my-product'
						}
					}),
					accessToken: 'test-token'
				};

				await displayRolloutInstructions({ device: 'device123' }, ui, mockApi);

				const output = ui._writes.join('\n');
				expect(output).to.include('https://console.staging.particle.io/my-product/devices/device123');
			});

			it('uses production console URL when isStaging is false', async () => {
				sinon.stub(settings, 'isStaging').value(false);

				await displayRolloutInstructions({ sandbox: true }, ui);

				const output = ui._writes.join('\n');
				expect(output).to.include('https://console.particle.io/env/edit');
				expect(output).to.not.include('.staging');
			});
		});
	});
});
