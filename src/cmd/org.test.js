'use strict';

const path = require('path');
const fs = require('fs-extra');
const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../test/setup');

const PATH_TMP_DIR = path.join(__dirname, '../../test/__tmp__');

describe('OrgCommand', () => {
	let OrgCommand, sandbox, stubs;

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
		await fs.ensureDir(PATH_TMP_DIR);

		stubs = {
			api: {
				exportOrgDevices: sandbox.stub()
			},
			settings: {
				apiUrl: 'https://api.particle.io',
				access_token: 'test-token'
			}
		};

		// Mock the ParticleAPI class
		function MockParticleAPI() {
			return stubs.api;
		}

		OrgCommand = proxyquire('./org', {
			'../../settings': stubs.settings,
			'./api': MockParticleAPI
		});
	});

	afterEach(async () => {
		sandbox.restore();
		await fs.remove(PATH_TMP_DIR);
	});

	describe('exportDevices', () => {
		it('exports devices as CSV to stdout by default', async () => {
			const mockDevices = [
				{
					id: 'device1',
					name: 'Test Device 1',
					product_id: 12345,
					platform_id: 6,
					online: true,
					last_heard: '2024-01-15T10:00:00Z',
					serial_number: 'SN001',
					iccid: null,
					groups: ['production'],
					firmware_version: '1.0.0'
				},
				{
					id: 'device2',
					name: 'Test Device 2',
					product_id: 12345,
					platform_id: 6,
					online: false,
					last_heard: '2024-01-14T10:00:00Z',
					serial_number: 'SN002',
					iccid: '89012345678901234567',
					groups: ['staging', 'beta'],
					firmware_version: '1.0.1'
				}
			];

			stubs.api.exportOrgDevices.resolves({
				devices: mockDevices,
				meta: { total_records: 2, total_pages: 1 }
			});

			const stdoutOutput = [];
			const cmd = new OrgCommand({
				stdout: {
					write: (data) => stdoutOutput.push(data)
				},
				stderr: {
					write: () => {}
				}
			});

			await cmd.exportDevices({
				format: 'csv',
				params: { org: 'test-org' }
			});

			expect(stubs.api.exportOrgDevices).to.have.been.calledOnce;
			expect(stubs.api.exportOrgDevices).to.have.been.calledWith({
				orgSlug: 'test-org',
				format: 'json',
				page: 1,
				perPage: 1000,
				productIds: undefined,
				groupIds: undefined
			});

			const output = stdoutOutput.join('');
			expect(output).to.include('Device ID');
			expect(output).to.include('device1');
			expect(output).to.include('device2');
			expect(output).to.include('production');
			expect(output).to.include('staging;beta');
		});

		it('exports devices as JSON when format is json', async () => {
			const mockDevices = [
				{
					id: 'device1',
					name: 'Test Device 1',
					product_id: 12345,
					platform_id: 6,
					online: true
				}
			];

			stubs.api.exportOrgDevices.resolves({
				devices: mockDevices,
				meta: { total_records: 1, total_pages: 1 }
			});

			const stdoutOutput = [];
			const cmd = new OrgCommand({
				stdout: {
					write: (data) => stdoutOutput.push(data)
				},
				stderr: {
					write: () => {}
				}
			});

			await cmd.exportDevices({
				format: 'json',
				params: { org: 'test-org' }
			});

			const output = stdoutOutput.join('');
			// Find the JSON content by looking for the opening brace
			const jsonStart = output.indexOf('{');
			expect(jsonStart).to.be.greaterThan(-1);
			const jsonContent = output.slice(jsonStart);
			const parsed = JSON.parse(jsonContent);
			expect(parsed.devices).to.have.lengthOf(1);
			expect(parsed.devices[0].id).to.equal('device1');
		});

		it('writes to file when output option is provided', async () => {
			const mockDevices = [
				{
					id: 'device1',
					name: 'Test Device 1',
					product_id: 12345,
					platform_id: 6,
					online: true
				}
			];

			stubs.api.exportOrgDevices.resolves({
				devices: mockDevices,
				meta: { total_records: 1, total_pages: 1 }
			});

			const outputFile = path.join(PATH_TMP_DIR, 'devices.csv');
			const stdoutOutput = [];
			const cmd = new OrgCommand({
				stdout: {
					write: (data) => stdoutOutput.push(data)
				},
				stderr: {
					write: () => {}
				}
			});

			await cmd.exportDevices({
				format: 'csv',
				output: outputFile,
				params: { org: 'test-org' }
			});

			expect(await fs.pathExists(outputFile)).to.be.true;
			const fileContent = await fs.readFile(outputFile, 'utf8');
			expect(fileContent).to.include('Device ID');
			expect(fileContent).to.include('device1');
		});

		it('passes product filter to API', async () => {
			stubs.api.exportOrgDevices.resolves({
				devices: [],
				meta: { total_records: 0, total_pages: 0 }
			});

			const cmd = new OrgCommand({
				stdout: { write: () => {} },
				stderr: { write: () => {} }
			});

			await cmd.exportDevices({
				format: 'csv',
				product: '12345,67890',
				params: { org: 'test-org' }
			});

			expect(stubs.api.exportOrgDevices).to.have.been.calledWith(
				sinon.match({
					productIds: '12345,67890'
				})
			);
		});

		it('passes group filter to API', async () => {
			stubs.api.exportOrgDevices.resolves({
				devices: [],
				meta: { total_records: 0, total_pages: 0 }
			});

			const cmd = new OrgCommand({
				stdout: { write: () => {} },
				stderr: { write: () => {} }
			});

			await cmd.exportDevices({
				format: 'csv',
				group: 'production,staging',
				params: { org: 'test-org' }
			});

			expect(stubs.api.exportOrgDevices).to.have.been.calledWith(
				sinon.match({
					groupIds: 'production,staging'
				})
			);
		});

		it('handles multiple pages of results', async () => {
			const page1Devices = [{ id: 'device1', name: 'Device 1' }];
			const page2Devices = [{ id: 'device2', name: 'Device 2' }];

			stubs.api.exportOrgDevices
				.onFirstCall().resolves({
					devices: page1Devices,
					meta: { total_records: 2, total_pages: 2 }
				})
				.onSecondCall().resolves({
					devices: page2Devices,
					meta: { total_records: 2, total_pages: 2 }
				});

			const stdoutOutput = [];
			const cmd = new OrgCommand({
				stdout: {
					write: (data) => stdoutOutput.push(data)
				},
				stderr: {
					write: () => {}
				}
			});

			await cmd.exportDevices({
				format: 'csv',
				params: { org: 'test-org' }
			});

			expect(stubs.api.exportOrgDevices).to.have.been.calledTwice;
			const output = stdoutOutput.join('');
			expect(output).to.include('device1');
			expect(output).to.include('device2');
		});

		it('handles API validation errors (400)', async () => {
			// Simulate how the API wrapper converts 400 errors - the message comes from the body
			const error = new Error('Product 99999 not found in organization');
			error.statusCode = 400;
			error.name = 'UnauthorizedError'; // API wrapper converts 400/401 to UnauthorizedError
			stubs.api.exportOrgDevices.rejects(error);

			const cmd = new OrgCommand({
				stdout: { write: () => {} },
				stderr: { write: () => {} }
			});

			try {
				await cmd.exportDevices({
					format: 'csv',
					product: '99999',
					params: { org: 'test-org' }
				});
				expect.fail('Expected error to be thrown');
			} catch (err) {
				expect(err.message).to.include('Product 99999 not found');
			}
		});

		it('retries on transient failures', async () => {
			const error = new Error('Server error');
			error.statusCode = 500;

			stubs.api.exportOrgDevices
				.onFirstCall().rejects(error)
				.onSecondCall().resolves({
					devices: [{ id: 'device1' }],
					meta: { total_records: 1, total_pages: 1 }
				});

			const stderrOutput = [];
			const cmd = new OrgCommand({
				stdout: { write: () => {} },
				stderr: {
					write: (data) => stderrOutput.push(data)
				}
			});

			await cmd.exportDevices({
				format: 'csv',
				params: { org: 'test-org' }
			});

			expect(stubs.api.exportOrgDevices).to.have.been.calledTwice;
			const stderrStr = stderrOutput.join('');
			expect(stderrStr).to.include('retrying');
		});

		it('handles empty results gracefully', async () => {
			stubs.api.exportOrgDevices.resolves({
				devices: [],
				meta: { total_records: 0, total_pages: 0 }
			});

			const stdoutOutput = [];
			const cmd = new OrgCommand({
				stdout: {
					write: (data) => stdoutOutput.push(data)
				},
				stderr: {
					write: () => {}
				}
			});

			await cmd.exportDevices({
				format: 'csv',
				params: { org: 'test-org' }
			});

			const output = stdoutOutput.join('');
			expect(output).to.include('No devices found');
		});

		it('throws error for invalid format', async () => {
			const cmd = new OrgCommand({
				stdout: { write: () => {} },
				stderr: { write: () => {} }
			});

			try {
				await cmd.exportDevices({
					format: 'xml',
					params: { org: 'test-org' }
				});
				expect.fail('Expected error to be thrown');
			} catch (err) {
				expect(err.message).to.include('Format must be either "csv" or "json"');
			}
		});
	});

	describe('_generateCsv', () => {
		it('escapes CSV fields with commas', () => {
			const cmd = new OrgCommand();
			const devices = [{
				id: 'device1',
				name: 'Device, with comma',
				product_id: 12345,
				platform_id: 6,
				online: true,
				groups: []
			}];

			const csv = cmd._generateCsv(devices);
			expect(csv).to.include('"Device, with comma"');
		});

		it('escapes CSV fields with quotes', () => {
			const cmd = new OrgCommand();
			const devices = [{
				id: 'device1',
				name: 'Device "Quoted"',
				product_id: 12345,
				platform_id: 6,
				online: true,
				groups: []
			}];

			const csv = cmd._generateCsv(devices);
			expect(csv).to.include('"Device ""Quoted"""');
		});

		it('handles null and undefined values', () => {
			const cmd = new OrgCommand();
			const devices = [{
				id: 'device1',
				name: null,
				product_id: undefined,
				platform_id: 6,
				online: false,
				groups: null
			}];

			const csv = cmd._generateCsv(devices);
			expect(csv).to.include('device1');
			// Should not throw and should handle null gracefully
		});
	});

	describe('_isRetryableError', () => {
		it('returns true for network errors (no status code)', () => {
			const cmd = new OrgCommand();
			const error = new Error('Network error');
			expect(cmd._isRetryableError(error)).to.be.true;
		});

		it('returns true for 500 errors', () => {
			const cmd = new OrgCommand();
			const error = new Error('Server error');
			error.statusCode = 500;
			expect(cmd._isRetryableError(error)).to.be.true;
		});

		it('returns true for 503 errors', () => {
			const cmd = new OrgCommand();
			const error = new Error('Service unavailable');
			error.statusCode = 503;
			expect(cmd._isRetryableError(error)).to.be.true;
		});

		it('returns false for 400 errors', () => {
			const cmd = new OrgCommand();
			const error = new Error('Bad request');
			error.statusCode = 400;
			expect(cmd._isRetryableError(error)).to.be.false;
		});

		it('returns false for 404 errors', () => {
			const cmd = new OrgCommand();
			const error = new Error('Not found');
			error.statusCode = 404;
			expect(cmd._isRetryableError(error)).to.be.false;
		});
	});
});
