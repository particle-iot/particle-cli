const { expect } = require('../../test/setup');
const util = require('./utilities');


describe('Utilities', () => {
	describe('arrayToHashSet()', () => {
		it('converts an array to an object', () => {
			const arr = ['foo', 'bar', 'baz'];

			expect(util.arrayToHashSet()).to.eql({});
			expect(util.arrayToHashSet(null)).to.eql({});
			expect(util.arrayToHashSet([])).to.eql({});
			expect(util.arrayToHashSet(arr)).to.eql({
				bar: true,
				baz: true,
				foo: true
			});
		});
	});

	describe('compliment()', () => {
		it('excludes keys', () => {
			const excluded = ['foo', 'baz'];
			const items = ['foo', 'bar', 'baz', 'qux'];

			expect(util.compliment(items, excluded)).to.eql(['bar', 'qux']);
		});
	});

	describe('buildDeviceFilter', () => {
		it('returns null if no filter string is provided', () => {
			expect(util.buildDeviceFilter()).to.eql(null);
		});

		describe('Built filter functions', () => {
			let deviceList;
			beforeEach(() => {
				deviceList = [
					{
						id: 'deadbeef1',
						name: 'device-a',
						platform_id: 6,
						connected: true
					},
					{
						id: 'deadbeef2',
						name: 'device-b',
						platform_id: 10,
						connected: true
					},
					{
						id: 'deadbeef3',
						name: 'device-c',
						platform_id: 13,
						connected: false
					}
				];
			});

			it('Filters devices by online', () => {
				let filterByOnline = util.buildDeviceFilter('online');

				let onlineDevices = deviceList.filter(filterByOnline);

				expect(onlineDevices).to.eql([
					{
						id: 'deadbeef1',
						name: 'device-a',
						platform_id: 6,
						connected: true
					},
					{
						id: 'deadbeef2',
						name: 'device-b',
						platform_id: 10,
						connected: true
					}
				]);
			});

			it('Filters devices by offline', () => {
				let filterByOffline = util.buildDeviceFilter('offline');

				let offlineDevices = deviceList.filter(filterByOffline);

				expect(offlineDevices).to.eql([
					{
						id: 'deadbeef3',
						name: 'device-c',
						platform_id: 13,
						connected: false
					}
				]);
			});

			it('Filters devices by platform name', () => {
				let electronOnly = util.buildDeviceFilter('electron');
				let boronOnly = util.buildDeviceFilter('boron');

				let electrons = deviceList.filter(electronOnly);
				let borons = deviceList.filter(boronOnly);

				expect(electrons).to.eql([
					{
						id: 'deadbeef2',
						name: 'device-b',
						platform_id: 10,
						connected: true
					}
				]);

				expect(borons).to.eql([
					{
						id: 'deadbeef3',
						name: 'device-c',
						platform_id: 13,
						connected: false
					}
				]);
			});

			it('Filters devices by Device ID', () => {
				let filterByName = util.buildDeviceFilter('deadbeef2');

				let matchingDevices = deviceList.filter(filterByName);

				expect(matchingDevices).to.eql([
					{
						id: 'deadbeef2',
						name: 'device-b',
						platform_id: 10,
						connected: true
					}
				]);
			});

			it('Filters devices by Device Name', () => {
				let filterByName = util.buildDeviceFilter('device-a');

				let matchingDevices = deviceList.filter(filterByName);

				expect(matchingDevices).to.eql([
					{
						id: 'deadbeef1',
						name: 'device-a',
						platform_id: 6,
						connected: true
					},
				]);
			});


		});
	});
});

