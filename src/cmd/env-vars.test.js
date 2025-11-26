'use strict';
const { expect, sinon } = require('../../test/setup');
const nock = require('nock');
const { sandboxList, sandboxProductList, sandboxDeviceProductList } = require('../../test/__fixtures__/env-vars/list');
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
				red: sinon.stub().callsFake((str) => str),
			},
		};
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
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving Environment Variables...');
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
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving Environment Variables...');
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
			expect(envVarsCommands.ui.showBusySpinnerUntilResolved).calledWith('Retrieving Environment Variables...');
			const writeCalls = envVarsCommands.ui.write.getCalls().map(c => c.args[0]);
			const blocks = parseBlocksFromCalls(writeCalls);
			expect(blocks).to.deep.equal([
				{ key: 'FOO', value: 'org-bar', scope: 'Owner' },
				{ key: 'FOO3', value: 'bar3 (Override)', scope: 'Owner' },
				{ key: 'FOO3_PROD', value: 'prod-bar3-prod', scope: 'Product' },
				{ key: 'FOO4', value: 'bar', scope: 'Owner' }
			]);

		});
	});
});
