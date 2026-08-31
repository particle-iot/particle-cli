'use strict';
const { expect } = require('../../test/setup');
const sinon = require('sinon');
const IdentifyTachyonCommand = require('./identify-tachyon');
const { regionFromModemFirmware, lookupCloudDeviceInfo } = require('../lib/tachyon-utils');

describe('regionFromModemFirmware', () => {
	it('reads NA out of a North America firmware string', () => {
		expect(regionFromModemFirmware('SG560DNAPAR60A03')).to.equal('NA');
	});

	it('reads RoW out of an EM firmware string', () => {
		expect(regionFromModemFirmware('SG560DEMPAR60A03')).to.equal('RoW');
	});

	it('returns null for an unrecognised region code', () => {
		expect(regionFromModemFirmware('SG560DZZPAR60A03')).to.equal(null);
	});

	it('returns null for a string that is not a SG560D firmware version', () => {
		expect(regionFromModemFirmware('EG25GGBR07A08M2G')).to.equal(null);
	});

	it('returns null for absent or non-string input', () => {
		expect(regionFromModemFirmware(undefined)).to.equal(null);
		expect(regionFromModemFirmware(null)).to.equal(null);
		expect(regionFromModemFirmware(42)).to.equal(null);
	});
});

describe('lookupCloudDeviceInfo', () => {
	const cloudDevice = {
		id: '422a060000000000d0c7965f',
		name: 'bobs-yellow-hat-d0c7965f',
		serial_number: 'P06400000000000',
		modem_firmware_version: 'SG560DNAPAR60A03',
		product_id: 35245,
		last_heard: '2026-08-31T02:57:13.857Z',
		linux_metadata: { distro: { version: '1.2.17', variant: 'headless' } }
	};

	it('derives the region and identity from the cloud record', async () => {
		const api = { getDevice: sinon.stub().resolves(cloudDevice) };

		const info = await lookupCloudDeviceInfo({ deviceId: cloudDevice.id, api });

		expect(info).to.eql({
			name: 'bobs-yellow-hat-d0c7965f',
			region: 'NA',
			serialNumber: 'P06400000000000',
			modemFirmwareVersion: 'SG560DNAPAR60A03',
			imageVersion: '1.2.17',
			imageVariant: 'headless',
			productId: 35245,
			lastHeard: '2026-08-31T02:57:13.857Z'
		});
		expect(api.getDevice).to.have.been.calledWith({ deviceId: cloudDevice.id });
	});

	it('copes with a record that has no linux_metadata', async () => {
		const api = { getDevice: sinon.stub().resolves({ id: 'abc', serial_number: 'P064' }) };

		const info = await lookupCloudDeviceInfo({ deviceId: 'abc', api });

		expect(info.imageVersion).to.equal(null);
		expect(info.region).to.equal(null);
		expect(info.serialNumber).to.equal('P064');
	});

	it('returns null when the device is not in the cloud', async () => {
		const api = { getDevice: sinon.stub().resolves({}) };
		expect(await lookupCloudDeviceInfo({ deviceId: 'abc', api })).to.equal(null);
	});

	it('returns null rather than throwing when the lookup fails', async () => {
		const api = { getDevice: sinon.stub().rejects(new Error('HTTP error 403')) };
		expect(await lookupCloudDeviceInfo({ deviceId: 'abc', api })).to.equal(null);
	});

	it('returns null when there is no api or no device id', async () => {
		expect(await lookupCloudDeviceInfo({ deviceId: 'abc', api: null })).to.equal(null);
		expect(await lookupCloudDeviceInfo({ deviceId: null, api: {} })).to.equal(null);
	});
});

describe('IdentifyTachyonCommand', () => {
	let ui;
	let output;
	const deviceId = '422a060000000000d0c7965f';

	const localRead = (overrides = {}) => ({
		deviceId,
		region: 'Unknown',
		manufacturingData: 'Found',
		osVersion: 'Ubuntu 24.04',
		...overrides
	});

	const cloudRead = (overrides = {}) => ({
		name: 'bobs-yellow-hat-d0c7965f',
		region: 'NA',
		serialNumber: 'P06400000000000',
		modemFirmwareVersion: 'SG560DNAPAR60A03',
		imageVersion: '1.2.17',
		imageVariant: 'headless',
		productId: 35245,
		lastHeard: null,
		...overrides
	});

	beforeEach(() => {
		output = [];
		ui = { stdout: { write: (msg) => output.push(msg) } };
	});

	const command = () => new IdentifyTachyonCommand({ ui, api: {} });
	const text = () => output.join('');

	describe('_merge', () => {
		it('prefers a region the device could answer and does not credit the cloud', () => {
			const merged = command()._merge({
				deviceId,
				cloudInfo: cloudRead({ region: 'RoW' }),
				localInfo: localRead({ region: 'NA' })
			});

			expect(merged.region).to.equal('NA');
			expect(merged.regionSource).to.equal(null);
		});

		it('falls back to the cloud region when the device read is Unknown', () => {
			const merged = command()._merge({ deviceId, cloudInfo: cloudRead(), localInfo: localRead() });

			expect(merged.region).to.equal('NA');
			expect(merged.regionSource).to.equal('Particle Cloud');
		});

		it('stays Unknown when neither source knows', () => {
			const merged = command()._merge({
				deviceId,
				cloudInfo: cloudRead({ region: null }),
				localInfo: localRead()
			});

			expect(merged.region).to.equal('Unknown');
			expect(merged.regionSource).to.equal(null);
		});

		it('reports cloud identity when the on-device read failed entirely', () => {
			const merged = command()._merge({ deviceId, cloudInfo: cloudRead(), localInfo: null });

			expect(merged.deviceId).to.equal(deviceId);
			expect(merged.region).to.equal('NA');
			expect(merged.serialNumber).to.equal('P06400000000000');
			expect(merged.manufacturingData).to.equal(null);
			expect(merged.osVersion).to.equal(null);
		});

		it('reports the on-device read when the cloud knows nothing', () => {
			const merged = command()._merge({
				deviceId,
				cloudInfo: null,
				localInfo: localRead({ region: 'NA' })
			});

			expect(merged.region).to.equal('NA');
			expect(merged.manufacturingData).to.equal('Found');
			expect(merged.serialNumber).to.equal(undefined);
		});
	});

	describe('printIdentification', () => {
		it('omits every field nothing could supply', () => {
			command().printIdentification(command()._merge({ deviceId, cloudInfo: null, localInfo: localRead({ region: 'NA' }) }));

			expect(text()).to.include('Device ID: 422a060000000000d0c7965f');
			expect(text()).to.include('Region: NA');
			expect(text()).to.not.include('Serial number');
			expect(text()).to.not.include('Image');
		});

		it('says where a cloud-sourced region came from', () => {
			command().printIdentification(command()._merge({ deviceId, cloudInfo: cloudRead(), localInfo: localRead() }));

			expect(text()).to.include('Region: NA (from Particle Cloud)');
			expect(text()).to.include('Serial number: P06400000000000');
			expect(text()).to.include('Modem firmware: SG560DNAPAR60A03');
			expect(text()).to.include('Image: 1.2.17 (headless)');
		});
	});
});
