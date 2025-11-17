'use strict';
const { expect } = require('../../test/setup');
const util = require('./utilities');
const path = require('path');
const fs = require('fs');
const { PATH_TMP_DIR } = require('../../test/lib/env');

describe('Utilities', () => {
	describe('knownPlatformIds', () => {
		it('returns a hash of platform ids', () => {
			expect(util.knownPlatformIds()).to.eql({
				'core': 0,
				'photon': 6,
				'p1': 8,
				'electron': 10,
				'argon': 12,
				'boron': 13,
				'xenon': 14,
				'esomx': 15,
				'bsom': 23,
				'b5som': 25,
				'tracker': 26,
				'trackerm': 28,
				'p2': 32,
				'msom': 35,
				'electron2': 37,
				'tachyon': 42,
				'linux': 43
			});
		});
	});

	describe('knownPlatformIdsWithAliases', () => {
		it('returns a hash of platform ids with aliases', () => {
			expect(util.knownPlatformIdsWithAliases()).to.eql({
				'core': 0,
				'c': 0,
				'photon': 6,
				'p': 6,
				'p1': 8,
				'electron': 10,
				'e': 10,
				'argon': 12,
				'a': 12,
				'boron': 13,
				'b': 13,
				'xenon': 14,
				'x': 14,
				'esomx': 15,
				'bsom': 23,
				'b5som': 25,
				'tracker': 26,
				'assettracker': 26,
				'trackerm': 28,
				'p2': 32,
				'photon2': 32,
				'msom': 35,
				'muon': 35,
				'electron2': 37,
				'tachyon': 42,
				'linux': 43
			});
		});
	});

	describe('knownPlatformDisplayForId', () => {
		it('returns a hash of platform display names', () => {
			expect(util.knownPlatformDisplayForId()).to.eql({
				0: 'Core',
				6: 'Photon',
				8: 'P1',
				10: 'Electron',
				12: 'Argon',
				13: 'Boron',
				14: 'Xenon',
				15: 'E-SoM-X',
				23: 'B-SoM',
				25: 'B5-SoM',
				26: 'Asset Tracker / Monitor One',
				28: 'Tracker-M',
				32: 'Photon 2 / P2',
				35: 'M-SoM',
				37: 'Electron 2',
				42: 'Tachyon',
				43: 'Linux'
			});
		});
	});

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
				const filterByOnline = util.buildDeviceFilter('online');

				const onlineDevices = deviceList.filter(filterByOnline);

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
				const filterByOffline = util.buildDeviceFilter('offline');

				const offlineDevices = deviceList.filter(filterByOffline);

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
				const electronOnly = util.buildDeviceFilter('electron');
				const boronOnly = util.buildDeviceFilter('boron');

				const electrons = deviceList.filter(electronOnly);
				const borons = deviceList.filter(boronOnly);

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
				const filterByName = util.buildDeviceFilter('deadbeef2');

				const matchingDevices = deviceList.filter(filterByName);

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
				const filterByName = util.buildDeviceFilter('device-a');

				const matchingDevices = deviceList.filter(filterByName);

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

	describe('filenameNoExt()', () => {
		it('returns the filename without the extension', () => {
			expect(util.filenameNoExt('foo')).to.eql('foo');
			expect(util.filenameNoExt('foo.bar')).to.eql('foo');
			expect(util.filenameNoExt('foo.bar.baz')).to.eql('foo.bar');
		});

		it('returns expected result when empty string is passed', () => {
			expect(util.filenameNoExt('')).to.eql('');
		});
	});

	describe('getFilenameExt()', () => {
		it('returns the filename extension', () => {
			expect(util.getFilenameExt('foo')).to.eql('');
			expect(util.getFilenameExt('foo.bar')).to.eql('.bar');
			expect(util.getFilenameExt('foo.bar.baz')).to.eql('.baz');
		});

		it('returns the filename extension in lowercase', () => {
			expect(util.getFilenameExt('foo.BAR')).to.eql('.bar');
			expect(util.getFilenameExt('foo.BAR.bAz')).to.eql('.baz');
		});

		it('returns expected result when empty string is passed', () => {
			expect(util.getFilenameExt('')).to.eql('');
		});
	});

	describe('parsePropertyFile()', () => {
		it('parses a property file', async () => {
			const tmpFile = path.join(PATH_TMP_DIR, 'project.properties');
			try {
				fs.writeFileSync(tmpFile, 'name=my_project\nassetOtaDir=my_assets_folder\n');
			} catch (e) {
				expect(e).to.be.null;
			}

			const result = await util.parsePropertyFile(tmpFile);
			expect(result).to.eql({
				name: 'my_project',
				assetOtaDir: 'my_assets_folder'
			});

			fs.unlinkSync(tmpFile);
		});

		it('returns an empty object if the file is empty', async () => {
			const tmpFile = path.join(PATH_TMP_DIR, 'project.properties');
			try {
				fs.writeFileSync(tmpFile, '');
			} catch (e) {
				expect(e).to.be.null;
			}

			const result = await util.parsePropertyFile(tmpFile);
			expect(result).to.eql({});

			fs.unlinkSync(tmpFile);
		});

		it('returns an error if the file does not exist', async () => {
			const tmpFile = 'fake-file';
			try {
				await util.parsePropertyFile(tmpFile);
			} catch (err) {
				// Windows logs the whole path to the file, so we optionally capture the start of the path D:\a\particle-cli\...\fake-file
				expect(err.message).to.match(/^ENOENT: no such file or directory, open '[\w\\:-]*fake-file'$/);
			}
		});
	});

	describe('execName', () => {
		it('returns the script name when executed as a regular script', () => {
			expect(util.execName({
				argv: [
					'/path/to/node',
					'/path/to/particle-cli/src/index.js'
				]
			})).to.equal('index.js');
		});

		it('returns the binary name when executed as a packaged binary', () => {
			expect(util.execName({
				argv0: 'particle',
				pkg: {}
			})).to.equal('particle');

			expect(util.execName({
				argv0: 'particle.exe',
				pkg: {}
			})).to.equal('particle');
		});
	});
});

