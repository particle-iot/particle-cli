const { expect } = require('../../test/setup');
const UsbCommands = require('./usb');


describe('USB Commands', () => {
	afterEach(() => {
	});


	describe('_formatNetworkIfaceOutput', () => {
		it('formats the interface information to imitate linux `ifconfig` command', async () => {
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
				'Device ID: \u001b[36m0123456789abcdef\u001b[39m (\u001b[36mp2\u001b[39m)',
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
			const res = await usbCommands._formatNetworkIfaceOutput(nwInfo, 'p2', '0123456789abcdef');

			expect(res).to.eql(expectedOutput);
		});
	});
});
