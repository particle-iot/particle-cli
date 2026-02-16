'use strict';
const { expect } = require('../../test/setup');
const { default: stripAnsi } = require('strip-ansi');
const UsbCommands = require('./usb');


describe('USB Commands', () => {
	afterEach(() => {
	});


	describe('_formatNetworkIfaceOutput', () => {
		it('formats the interface information to imitate linux `ifconfig` command', () => {
			const nwInfo = [
				{
					'index': 5,
					'name': 'wl4',
					'type': 'WIFI',
					'hwAddress': '94:94:4a:04:af:80',
					'mtu': 1500,
					'flagsVal': 98371,
					'extFlags': 1114112,
					'flagsStrings': ['UP', 'BROADCAST', 'LOWER_UP', 'LOWER_UP', 'MULTICAST', 'NOND6'],
					'metric': 0,
					'profile': Buffer.alloc(0),
					'ipv4Config': {
						'addresses': ['10.2.3.4/32'],
						'gateway': null,
						'peer': null,
						'dns': [],
						'source': 'NONE'
					},
					'ipv6Config': {
						'addresses': [],
						'gateway': null,
						'dns': [],
						'source': 'NONE'
					}
				},
				{
					'index': 4,
					'name': 'pp3',
					'type': 'PPP',
					'hwAddress': '',
					'mtu': 1500,
					'flagsVal': 81,
					'extFlags': 1048576,
					'flagsStrings': ['UP', 'POINTOPOINT', 'LOWER_UP', 'LOWER_UP'],
					'metric': 0,
					'profile': Buffer.alloc(0),
					'ipv4Config': {
						'addresses': ['10.20.30.40/32'],
						'gateway': null,
						'peer': null,
						'dns': [],
						'source': 'NONE'
					},
					'ipv6Config': {
						'addresses': [],
						'gateway': null,
						'dns': [],
						'source': 'NONE'
					}
				},
				{
					'index': 1,
					'name': 'lo0',
					'type': 'LOOPBACK',
					'hwAddress': '',
					'mtu': 0,
					'flagsVal': 73,
					'extFlags': 0,
					'flagsStrings': ['UP', 'LOOPBACK', 'LOWER_UP', 'LOWER_UP'],
					'metric': 0,
					'profile': Buffer.alloc(0),
					'ipv4Config': {
						'addresses': ['10.11.12.13/32'],
						'gateway': null,
						'peer': null,
						'dns': [],
						'source': 'NONE'
					},
					'ipv6Config': {
						'addresses': ['0000:0000:0000:0000:0000:0000:0000:0001/64'],
						'gateway': null,
						'dns': [],
						'source': 'NONE'
					}
				}
			];

			const expectedOutput = [
				'Device ID: 0123456789abcdef (p2)',
				'\twl4(WIFI): flags=98371<UP,BROADCAST,LOWER_UP,LOWER_UP,MULTICAST,NOND6> mtu 1500',
				'\t\tinet 10.2.3.4 netmask 255.255.255.255',
				'\t\tether 94:94:4a:04:af:80',
				'\tpp3(PPP): flags=81<UP,POINTOPOINT,LOWER_UP,LOWER_UP> mtu 1500',
				'\t\tinet 10.20.30.40 netmask 255.255.255.255',
				'\tlo0(LOOPBACK): flags=73<UP,LOOPBACK,LOWER_UP,LOWER_UP> mtu 0',
				'\t\tinet 10.11.12.13 netmask 255.255.255.255',
				'\t\tinet6 0000:0000:0000:0000:0000:0000:0000:0001 prefixlen 64'
			];

			const usbCommands = new UsbCommands({
				settings: {
					access_token: '1234'
				},
			});
			const res = usbCommands._formatNetworkIfaceOutput(nwInfo, 'p2', '0123456789abcdef');

			expect(res.map(stripAnsi)).to.eql(expectedOutput);
		});
	});

	describe('_formatEnvOutput', () => {
		let usbCommands;

		beforeEach(() => {
			usbCommands = new UsbCommands({
				access_token: '1234',
				apiUrl: 'https://api.particle.io'
			});
		});

		it('formats output with both application and system variables', () => {
			const result = {
				env: {
					APP_KEY: { value: 'app_value', isApp: true },
					SYS_KEY: { value: 'sys_value', isApp: false },
					ANOTHER_APP: { value: 'another_app', isApp: true }
				}
			};

			const output = usbCommands._formatEnvOutput(result, 'Photon', 'abc123def456');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput[0]).to.equal('Device: abc123def456 (Photon)');
			expect(cleanOutput[1]).to.equal('');
			const tableOutput = cleanOutput[2];
			const tableLines = tableOutput.split('\n');
			const findRow = (label) => tableLines.find(line => line.includes(label));
			const appKeyRow = findRow('APP_KEY');
			const sysKeyRow = findRow('SYS_KEY');
			const anotherAppRow = findRow('ANOTHER_APP');
			expect(appKeyRow).to.include('app_value');
			expect(appKeyRow).to.include('Firmware');
			expect(sysKeyRow).to.include('sys_value');
			expect(sysKeyRow).to.include('Cloud');
			expect(anotherAppRow).to.include('another_app');
			expect(anotherAppRow).to.include('Firmware');
		});

		it('formats output when no environment variables are set', () => {
			const result = {
				env: {}
			};

			const output = usbCommands._formatEnvOutput(result, 'Argon', 'device123');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput).to.deep.equal([
				'Device: device123 (Argon)',
				'',
				'  No environment variables set'
			]);
		});

		it('sorts variables alphabetically within each category', () => {
			const result = {
				env: {
					ZEBRA: { value: 'z', isApp: false },
					APPLE: { value: 'a', isApp: true },
					BANANA: { value: 'b', isApp: true },
					SYS_Z: { value: 'sz', isApp: false },
					SYS_A: { value: 'sa', isApp: false }
				}
			};

			const output = usbCommands._formatEnvOutput(result, 'P2', 'device123');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput[0]).to.equal('Device: device123 (P2)');
			expect(cleanOutput[1]).to.equal('');
			const tableOutput = cleanOutput[2];
			let previousIndex = -1, currentIndex = -1;
			['APPLE', 'BANANA', 'SYS_A', 'SYS_Z', 'ZEBRA'].forEach(varName => {
				expect(tableOutput).to.include(varName);
				previousIndex = currentIndex;
				currentIndex = tableOutput.indexOf(varName);
				expect(currentIndex).to.be.greaterThan(previousIndex);
			});
		});

		it('handles special characters in values', () => {
			const result = {
				env: {
					SPECIAL: { value: 'value with spaces & symbols!@#$%', isApp: true }
				}
			};

			const output = usbCommands._formatEnvOutput(result, 'P2', 'device123');
			const cleanOutput = output.map(stripAnsi);

			expect(cleanOutput[0]).to.equal('Device: device123 (P2)');
			expect(cleanOutput[1]).to.equal('');
			const tableOutput = cleanOutput[2];
			expect(tableOutput).to.include('SPECIAL');
			expect(tableOutput).to.include('value with spaces & symbols!@#$%');
			expect(tableOutput).to.include('Firmware');
		});
	});
});
