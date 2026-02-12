'use strict';
const { expect, sinon } = require('../../test/setup');
const {
	hasPendingChanges,
	getSortedEnvKeys,
	resolveValue,
	resolveScope,
	calculateColumnWidths,
	buildEnvRow,
	buildEnvTable,
	displayEnv,
	displayRolloutChanges
} = require('./env');

describe('lib/env', () => {
	describe('hasPendingChanges', () => {
		it('returns false when no changes exist', () => {
			const lastSnapshotRendered = {
				FOO: 'bar',
				BAZ: 'qux'
			};
			const envOwn = {
				FOO: { value: 'bar' },
				BAZ: { value: 'qux' }
			};

			const result = hasPendingChanges(lastSnapshotRendered, envOwn);
			expect(result).to.equal(false);
		});

		it('returns true when a value has changed', () => {
			const lastSnapshotRendered = {
				FOO: 'bar',
				BAZ: 'qux'
			};
			const envOwn = {
				FOO: { value: 'bar' },
				BAZ: { value: 'changed' }
			};

			const result = hasPendingChanges(lastSnapshotRendered, envOwn);
			expect(result).to.equal(true);
		});

		it('returns true when a new variable is added', () => {
			const lastSnapshotRendered = {
				FOO: 'bar'
			};
			const envOwn = {
				FOO: { value: 'bar' },
				NEW: { value: 'value' }
			};

			const result = hasPendingChanges(lastSnapshotRendered, envOwn);
			expect(result).to.equal(true);
		});

		it('returns false when envOwn is empty', () => {
			const lastSnapshotRendered = {
				FOO: 'bar'
			};
			const envOwn = {};

			const result = hasPendingChanges(lastSnapshotRendered, envOwn);
			expect(result).to.equal(false);
		});
	});

	describe('getSortedEnvKeys', () => {
		it('returns sorted keys from last_snapshot.rendered and env.inherited', () => {
			const data = {
				last_snapshot: {
					rendered: {
						ZEBRA: 'z',
						APPLE: 'a'
					}
				},
				env: {
					inherited: {
						BANANA: { from: 'Owner', value: 'b' }
					}
				}
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal(['APPLE', 'BANANA', 'ZEBRA']);
		});

		it('returns unique keys when keys exist in both snapshot and inherited', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar',
						BAZ: 'qux'
					}
				},
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'inherited' },
						ANOTHER: { from: 'Owner', value: 'value' }
					}
				}
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal(['ANOTHER', 'BAZ', 'FOO']);
		});

		it('returns empty array when no keys exist', () => {
			const data = {
				last_snapshot: { rendered: {} },
				env: { inherited: {} }
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal([]);
		});

		it('handles missing last_snapshot', () => {
			const data = {
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'bar' }
					}
				}
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal(['FOO']);
		});

		it('handles missing env.inherited', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				}
			};

			const result = getSortedEnvKeys(data);
			expect(result).to.deep.equal(['FOO']);
		});
	});

	describe('resolveValue', () => {
		it('returns snapshot value when available', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'snapshot-value'
					}
				},
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'inherited-value' }
					},
					own: {
						FOO: { value: 'own-value' }
					}
				}
			};

			const result = resolveValue('FOO', data);
			expect(result).to.equal('snapshot-value');
		});

		it('returns own value when snapshot is not available', () => {
			const data = {
				last_snapshot: { rendered: {} },
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'inherited-value' }
					},
					own: {
						FOO: { value: 'own-value' }
					}
				}
			};

			const result = resolveValue('FOO', data);
			expect(result).to.equal('own-value');
		});

		it('returns inherited value when snapshot and own are not available', () => {
			const data = {
				last_snapshot: { rendered: {} },
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'inherited-value' }
					},
					own: {}
				}
			};

			const result = resolveValue('FOO', data);
			expect(result).to.equal('inherited-value');
		});

		it('returns empty string when no value is found', () => {
			const data = {
				last_snapshot: { rendered: {} },
				env: {
					inherited: {},
					own: {}
				}
			};

			const result = resolveValue('NONEXISTENT', data);
			expect(result).to.equal('');
		});
	});

	describe('resolveScope', () => {
		describe('sandbox/org scope', () => {
			it('returns Organization for sandbox scope', () => {
				const data = {
					env: {
						inherited: {},
						own: {
							FOO: { value: 'bar' }
						}
					}
				};

				const result = resolveScope('FOO', data, { sandbox: true });
				expect(result).to.deep.equal({ scope: 'Organization', isOverridden: false });
			});

			it('returns Organization for org scope', () => {
				const data = {
					env: {
						inherited: {},
						own: {
							FOO: { value: 'bar' }
						}
					}
				};

				const result = resolveScope('FOO', data, { org: 'my-org' });
				expect(result).to.deep.equal({ scope: 'Organization', isOverridden: false });
			});
		});

		describe('product scope', () => {
			it('returns Product scope for own variable', () => {
				const data = {
					last_snapshot: {
						rendered: {
							FOO: 'bar'
						}
					},
					env: {
						inherited: {},
						own: {
							FOO: { value: 'bar' }
						}
					}
				};

				const result = resolveScope('FOO', data, { product: 'my-product' });
				expect(result).to.deep.equal({ scope: 'Product', isOverridden: false });
			});

			it('returns isOverridden true when own variable overrides inherited', () => {
				const data = {
					last_snapshot: {
						rendered: {
							FOO: 'product-value'
						}
					},
					env: {
						inherited: {
							FOO: { from: 'Owner', value: 'org-value' }
						},
						own: {
							FOO: { value: 'product-value' }
						}
					}
				};

				const result = resolveScope('FOO', data, { product: 'my-product' });
				expect(result).to.deep.equal({ scope: 'Product', isOverridden: true });
			});

			it('returns Organization scope for inherited variable from Owner', () => {
				const data = {
					last_snapshot: {
						rendered: {
							FOO: 'bar'
						}
					},
					env: {
						inherited: {
							FOO: { from: 'Owner', value: 'bar' }
						},
						own: {}
					}
				};

				const result = resolveScope('FOO', data, { product: 'my-product' });
				expect(result).to.deep.equal({ scope: 'Organization', isOverridden: false });
			});

			it('returns Product scope for inherited variable from Product', () => {
				const data = {
					last_snapshot: {
						rendered: {
							FOO: 'bar'
						}
					},
					env: {
						inherited: {
							FOO: { from: 'Product', value: 'bar' }
						},
						own: {}
					}
				};

				const result = resolveScope('FOO', data, { product: 'my-product' });
				expect(result).to.deep.equal({ scope: 'Product', isOverridden: false });
			});
		});

		describe('device scope', () => {
			it('returns Device scope for own variable', () => {
				const data = {
					last_snapshot: {
						rendered: {
							FOO: 'bar'
						}
					},
					env: {
						inherited: {},
						own: {
							FOO: { value: 'bar' }
						}
					}
				};

				const result = resolveScope('FOO', data, { device: 'my-device' });
				expect(result).to.deep.equal({ scope: 'Device', isOverridden: false });
			});

			it('returns isOverridden true when own variable matches snapshot', () => {
				const data = {
					last_snapshot: {
						rendered: {
							FOO: 'device-value'
						}
					},
					env: {
						inherited: {
							FOO: { from: 'Product', value: 'product-value' }
						},
						own: {
							FOO: { value: 'device-value' }
						}
					}
				};

				const result = resolveScope('FOO', data, { device: 'my-device' });
				expect(result).to.deep.equal({ scope: 'Device', isOverridden: true });
			});

			it('returns isOverridden true when own variable matches on_device', () => {
				const data = {
					on_device: {
						FOO: 'device-value'
					},
					env: {
						inherited: {
							FOO: { from: 'Product', value: 'product-value' }
						},
						own: {
							FOO: { value: 'device-value' }
						}
					}
				};

				const result = resolveScope('FOO', data, { device: 'my-device' });
				expect(result).to.deep.equal({ scope: 'Device', isOverridden: true });
			});

			it('returns Device scope for inherited variable from Device', () => {
				const data = {
					env: {
						inherited: {
							FOO: { from: 'Device', value: 'bar' }
						},
						own: {}
					}
				};

				const result = resolveScope('FOO', data, { device: 'my-device' });
				expect(result).to.deep.equal({ scope: 'Device', isOverridden: false });
			});

			it('returns Product scope for inherited variable from Product', () => {
				const data = {
					env: {
						inherited: {
							FOO: { from: 'Product', value: 'bar' }
						},
						own: {}
					}
				};

				const result = resolveScope('FOO', data, { device: 'my-device' });
				expect(result).to.deep.equal({ scope: 'Product', isOverridden: false });
			});

			it('returns Organization scope for inherited variable from Owner', () => {
				const data = {
					env: {
						inherited: {
							FOO: { from: 'Owner', value: 'bar' }
						},
						own: {}
					}
				};

				const result = resolveScope('FOO', data, { device: 'my-device' });
				expect(result).to.deep.equal({ scope: 'Organization', isOverridden: false });
			});
		});
	});

	describe('calculateColumnWidths', () => {
		it('calculates widths based on content', () => {
			const data = {
				last_snapshot: {
					rendered: {
						'SHORT': 'val',
						'VERY_LONG_VARIABLE_NAME': 'this is a very long value'
					}
				},
				env: {
					inherited: {},
					own: {
						'SHORT': { value: 'val' },
						'VERY_LONG_VARIABLE_NAME': { value: 'this is a very long value' }
					}
				}
			};

			const sortedKeys = ['SHORT', 'VERY_LONG_VARIABLE_NAME'];
			const result = calculateColumnWidths(sortedKeys, data, { sandbox: true });

			// Name column should be at least as wide as the longest key plus padding
			expect(result.nameWidth).to.be.at.least('VERY_LONG_VARIABLE_NAME'.length);
			// Value column should be at least as wide as the longest value plus padding
			expect(result.valueWidth).to.be.at.least('this is a very long value'.length);
			// Scope column should accommodate 'Organization'
			expect(result.scopeWidth).to.be.at.least('Organization'.length);
		});

		it('includes onDevice column width when device scope is used', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				},
				on_device: {
					FOO: 'very-long-on-device-value'
				}
			};

			const sortedKeys = ['FOO'];
			const result = calculateColumnWidths(sortedKeys, data, { device: 'my-device' });

			expect(result.onDeviceWidth).to.be.at.least('very-long-on-device-value'.length);
		});

		it('handles missing on_device data', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				},
				on_device: null
			};

			const sortedKeys = ['FOO'];
			const result = calculateColumnWidths(sortedKeys, data, { device: 'my-device' });

			// Should at least accommodate 'missing'
			expect(result.onDeviceWidth).to.be.at.least('missing'.length);
		});

		it('sets minimum widths based on headers', () => {
			const data = {
				last_snapshot: { rendered: {} },
				env: {
					inherited: {},
					own: {}
				}
			};

			const sortedKeys = [];
			const result = calculateColumnWidths(sortedKeys, data, { sandbox: true });

			// Headers + padding
			expect(result.nameWidth).to.be.at.least('Name'.length + 2);
			expect(result.valueWidth).to.be.at.least('Value'.length + 2);
			expect(result.scopeWidth).to.be.at.least('Scope'.length + 2);
			expect(result.overriddenWidth).to.be.at.least('Overridden'.length + 2);
		});
	});

	describe('buildEnvRow', () => {
		it('builds a row with key, value, scope, and overridden status', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				}
			};

			const result = buildEnvRow('FOO', data, { sandbox: true });
			expect(result).to.deep.equal(['FOO', 'bar', 'Organization', 'No']);
		});

		it('includes on_device column when device scope is used', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				},
				on_device: {
					FOO: 'on-device-value'
				}
			};

			const result = buildEnvRow('FOO', data, { device: 'my-device' });
			expect(result).to.deep.equal(['FOO', 'bar', 'on-device-value', 'Device', 'No']);
		});

		it('shows "missing" for on_device when value is not present', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				},
				on_device: {}
			};

			const result = buildEnvRow('FOO', data, { device: 'my-device' });
			expect(result).to.deep.equal(['FOO', 'bar', 'missing', 'Device', 'No']);
		});

		it('shows "Yes" for overridden status when applicable', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'override-value'
					}
				},
				env: {
					inherited: {
						FOO: { from: 'Owner', value: 'original' }
					},
					own: {
						FOO: { value: 'override-value' }
					}
				}
			};

			const result = buildEnvRow('FOO', data, { product: 'my-product' });
			expect(result).to.deep.equal(['FOO', 'override-value', 'Product', 'Yes']);
		});
	});

	describe('buildEnvTable', () => {
		it('builds a table with proper structure', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
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
			expect(output).to.include('Organization');
		});

		it('handles very long environment variable names without truncation', () => {
			const longName = 'VERY_LONG_ENVIRONMENT_VARIABLE_NAME_THAT_EXCEEDS_TYPICAL_LENGTH';
			const data = {
				last_snapshot: {
					rendered: {
						[longName]: 'value'
					}
				},
				env: {
					inherited: {},
					own: {
						[longName]: { value: 'value' }
					}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			// Should include the full name without truncation
			expect(output).to.include(longName);
			// Should not include truncation indicator
			expect(output).to.not.include('...');
		});

		it('handles very long environment variable values without truncation', () => {
			const longValue = 'var_too_long_1234567890abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890';
			const data = {
				last_snapshot: {
					rendered: {
						API_KEY: longValue
					}
				},
				env: {
					inherited: {},
					own: {
						API_KEY: { value: longValue }
					}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			// Should include the full value without truncation
			expect(output).to.include(longValue);
			// Should not include truncation indicator at the value position
			const lines = output.split('\n');
			const apiKeyLine = lines.find(line => line.includes('API_KEY'));
			expect(apiKeyLine).to.exist;
			expect(apiKeyLine).to.include(longValue);
		});

		it('handles multiple variables with varying lengths and adjusts columns accordingly', () => {
			const data = {
				last_snapshot: {
					rendered: {
						SHORT: 'val',
						MEDIUM_LENGTH_VAR: 'medium value here',
						VERY_LONG_VARIABLE_NAME_EXCEEDING_NORMAL_LIMITS: 'this is a very long value that should be fully displayed without any truncation at all',
						X: 'y'
					}
				},
				env: {
					inherited: {},
					own: {
						SHORT: { value: 'val' },
						MEDIUM_LENGTH_VAR: { value: 'medium value here' },
						VERY_LONG_VARIABLE_NAME_EXCEEDING_NORMAL_LIMITS: { value: 'this is a very long value that should be fully displayed without any truncation at all' },
						X: { value: 'y' }
					}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			// All variable names should be present
			expect(output).to.include('SHORT');
			expect(output).to.include('MEDIUM_LENGTH_VAR');
			expect(output).to.include('VERY_LONG_VARIABLE_NAME_EXCEEDING_NORMAL_LIMITS');
			expect(output).to.include('X');

			// All values should be present in full
			expect(output).to.include('val');
			expect(output).to.include('medium value here');
			expect(output).to.include('this is a very long value that should be fully displayed without any truncation at all');
			expect(output).to.include('y');
		});

		it('handles long on_device values for device scope without truncation', () => {
			const longOnDeviceValue = 'on-device-value-that-is-extremely-long-and-should-not-be-truncated-123456789';
			const data = {
				last_snapshot: {
					rendered: {
						CONFIG: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						CONFIG: { value: 'bar' }
					}
				},
				on_device: {
					CONFIG: longOnDeviceValue
				}
			};

			const table = buildEnvTable(data, { device: 'my-device' });
			const output = table.toString();

			// Should include the full on_device value
			expect(output).to.include(longOnDeviceValue);
			expect(output).to.include('On Device');
		});

		it('includes On Device column for device scope', () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				},
				on_device: {
					FOO: 'device-val'
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
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				}
			};

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			expect(output).to.not.include('On Device');
		});

		it('sorts variables alphabetically', () => {
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

			const table = buildEnvTable(data, { sandbox: true });
			const output = table.toString();

			const appleIndex = output.indexOf('APPLE');
			const bananaIndex = output.indexOf('BANANA');
			const zebraIndex = output.indexOf('ZEBRA');

			expect(appleIndex).to.be.lessThan(bananaIndex);
			expect(bananaIndex).to.be.lessThan(zebraIndex);
		});
	});

	describe('displayEnv', () => {
		let ui;

		beforeEach(() => {
			ui = {
				write: [],
				chalk: {
					yellow: (str) => str,
					cyan: (str) => str,
					bold: (str) => str,
					green: (str) => str
				}
			};
			// Capture writes
			ui.write = function(str) {
				this._writes = this._writes || [];
				this._writes.push(str);
			};
			ui.chalk.cyan.bold = (str) => str;
			ui.chalk.yellow.bold = (str) => str;
		});

		it('displays table when variables exist', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('FOO');
			expect(output).to.include('bar');
		});

		it('displays "No environment variables found" when empty', async () => {
			const data = {
				last_snapshot: { rendered: {} },
				env: {
					inherited: {},
					own: {}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			expect(ui._writes[0]).to.equal('No environment variables found.');
		});

		it('displays pending changes warning when changes exist', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'old-value'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'new-value' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('There are pending changes that have not been applied yet.');
			expect(output).to.include('To review and save this changes in the console');
		});

		it('does not display pending changes warning when no changes exist', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'bar'
					}
				},
				env: {
					inherited: {},
					own: {
						FOO: { value: 'bar' }
					}
				}
			};

			await displayEnv(data, { sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.not.include('There are pending changes that have not been applied yet.');
			expect(output).to.not.include('To review and save this changes in the console');
		});

		it('displays rollout URL for sandbox when pending changes exist', async () => {
			const data = {
				last_snapshot: {
					rendered: {
						FOO: 'old-value'
					}
				},
				env: {
					inherited: {},
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
					rendered: {
						FOO: 'old-value'
					}
				},
				env: {
					inherited: {},
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
					rendered: {
						FOO: 'old-value'
					}
				},
				env: {
					inherited: {},
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

	describe('displayRolloutChanges', () => {
		let ui;

		beforeEach(() => {
			ui = {
				write: [],
				chalk: {
					bold: (str) => str,
					cyan: {
						bold: (str) => str
					},
					green: (str) => str,
					red: (str) => str,
					yellow: (str) => str,
					gray: (str) => str
				}
			};
			// Capture writes
			ui.write = function(str) {
				this._writes = this._writes || [];
				this._writes.push(str);
			};
		});

		it('displays added changes', () => {
			const rolloutData = {
				changes: [
					{ op: 'Added', key: 'NEW_VAR', after: 'new-value' }
				],
				unchanged: {}
			};

			displayRolloutChanges(rolloutData, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('NEW_VAR');
			expect(output).to.include('new-value');
			expect(output).to.include('+');
		});

		it('displays removed changes', () => {
			const rolloutData = {
				changes: [
					{ op: 'Removed', key: 'OLD_VAR' }
				],
				unchanged: {}
			};

			displayRolloutChanges(rolloutData, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('OLD_VAR');
			expect(output).to.include('-');
		});

		it('displays changed variables', () => {
			const rolloutData = {
				changes: [
					{ op: 'Changed', key: 'MODIFIED', before: 'old', after: 'new' }
				],
				unchanged: {}
			};

			displayRolloutChanges(rolloutData, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('MODIFIED');
			expect(output).to.include('old');
			expect(output).to.include('new');
			expect(output).to.include('~');
		});

		it('displays unchanged variables', () => {
			const rolloutData = {
				changes: [],
				unchanged: {
					SAME: 'value'
				}
			};

			displayRolloutChanges(rolloutData, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('SAME');
			expect(output).to.include('value');
			expect(output).to.include('Unchanged environment variables');
		});

		it('displays "No changes to be applied" when no changes', () => {
			const rolloutData = {
				changes: [],
				unchanged: {}
			};

			displayRolloutChanges(rolloutData, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('No changes to be applied');
		});
	});

	describe('displayRolloutInstructions', () => {
		const { displayRolloutInstructions } = require('./env');
		let ui;

		beforeEach(() => {
			ui = {
				write: [],
				chalk: {
					green: (str) => str,
					yellow: (str) => str,
					cyan: (str) => str
				}
			};
			// Capture writes
			ui.write = function(str) {
				this._writes = this._writes || [];
				this._writes.push(str);
			};
		});

		it('displays sandbox rollout URL', async () => {
			await displayRolloutInstructions({ sandbox: true }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('To review and save this changes in the console');
			expect(output).to.include('https://console.particle.io/env/edit');
		});

		it('displays org rollout URL', async () => {
			await displayRolloutInstructions({ org: 'my-org' }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('To review and save this changes in the console');
			expect(output).to.include('https://console.particle.io/orgs/my-org/env/edit');
		});

		it('displays product rollout URL', async () => {
			await displayRolloutInstructions({ product: '12345' }, ui);

			const output = ui._writes.join('\n');
			expect(output).to.include('To review and save this changes in the console');
			expect(output).to.include('https://console.particle.io/12345/env/edit');
		});

		it('displays device URL with product_id when device is in a product', async () => {
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
			expect(output).to.include('To review and save this changes in the console');
			expect(output).to.include('https://console.particle.io/my-product/devices/device123');
		});

		it('displays device URL without product_id when device is not in a product', async () => {
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
			expect(output).to.include('To review and save this changes in the console');
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
				// Restore original value
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

