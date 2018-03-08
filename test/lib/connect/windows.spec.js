'use strict';
import { sinon, expect } from '../../test-setup';

const windowsWiFi = require('../../../src/lib/connect/windows.js');
var Connector = windowsWiFi.Connector;

describe('Windows wifi', function() {
	var sut;

	beforeEach(function() {
		// default sut has no executor
		sut = new Connector(sinon.stub().throws('don\'t push me'));
	});

	describe('asCallback', function() {
		it('handles success', function() {
			var value = 123;

			function handler(err, data) {
				expect(data).to.be.eql(value);
				expect(err).to.be.not.ok;
			}
			return windowsWiFi.asCallback(Promise.resolve(value), handler);
		});

		it('handles rejection', function() {
			var rejection = 'My hat is too big';

			function handler(err, data) {
				expect(err).to.be.eql(rejection);
				expect(data).to.be.undefined;
			}
			return windowsWiFi.asCallback(Promise.reject(rejection), handler);
		});
	});

	describe('_exec', function() {
		it('invokes the command executor', function() {
			var executor = sinon.stub().returns(Promise.resolve(123));
			var sut = new Connector(executor);
			var args = ['a', 'b', 'c'];
			return sut._exec(args).then(function() {
				expect(executor).to.have.been.calledWith(args);
			});
		});
	});

	describe('_execWiFiCommand', function() {
		it('invokes the command executor with a "netsh wlan" prefix', function() {
			var executor = sinon.stub().returns(Promise.resolve(123));
			var sut = new Connector(executor);
			var args = ['a', 'b', 'c'];
			return sut._execWiFiCommand(args).then(function() {
				expect(executor).to.have.been.calledWith(['netsh', 'wlan', 'a', 'b', 'c']);
			});
		});
	});

	describe('parsing', function () {
		describe('_stringToLines', function() {
			it('converts all kinds of line endings', function() {
				var s = `one\ntwo\r\nthree\r\n\n\n\n`;
				var lines = sut._stringToLines(s);
				expect(lines).to.be.eql(['one', 'two', 'three']);
			});

			it('returns the empty array when there are no lines', function() {
				expect(sut._stringToLines('')).to.be.eql([]);
			});

			it('returns a single line', function() {
				expect(sut._stringToLines('abcd\n')).to.be.eql(['abcd']);
			});

		});

		describe('_keyValue', function() {
			it('returns undefined if no colon', function() {
				var result = sut._keyValue('key value');
				expect(result).to.be.eql(undefined);
			});

			it('splits at the first colon', function() {
				var result = sut._keyValue('key space: value : value 2');
				expect(result).to.have.property('key').eql('key space');
				expect(result).to.have.property('value').eql('value : value 2');
			});

			it('returns the key lowercased, and value in original case', function() {
				var result = sut._keyValue('KeY     :    MY VALUE');
				expect(result).to.have.property('key').eql('key');
				expect(result).to.have.property('value').eql('MY VALUE');
			});

			it('trims external whitespace', function() {
				var result = sut._keyValue('KeY       :    MY VALUE   ');
				expect(result).to.have.property('key').eql('key');
				expect(result).to.have.property('value').eql('MY VALUE');
			});
		});

		describe('_extractInterface', function() {
			it('ignores properties up to the first name', function() {
				var lines = `
				blah: blah
				Name: bob
				Favorite food: worms
				`.split('\n');

				var data = sut._extractInterface(lines);
				expect(data).to.be.ok;
				expect(data.range).to.eql({start:2, end:5});
				expect(data.iface).to.not.have.property('blah');
				expect(data.iface).to.have.property('name').eql('bob');
				expect(data.iface).to.have.property('favorite food').eql('worms');
			});

			it('gathers properties up to the next name from the start', function() {
				var lines = `
				blah: blah
				Name: bob
				Favorite food: worms
				pet: dogs
				
				name: joe
				height: 1234
				`.split('\n');

				var data = sut._extractInterface(lines);
				expect(data).to.be.ok;
				expect(data.range).to.eql({start:2, end:6});
				expect(data.iface).to.not.have.property('blah');
				expect(data.iface).to.have.property('name').eql('bob');
				expect(data.iface).to.have.property('favorite food').eql('worms');
				expect(data.iface).to.have.property('pet').eql('dogs');
				expect(data.iface).to.not.have.property('height');
			});


			it('gathers properties up to the next name from the index given', function() {
				var lines = `
				blah: blah
				Name: bob
				Favorite food: worms
				pet: dogs
				
				name: joe
				height: 1234
				
				
				`.split('\n');

				var data = sut._extractInterface(lines, 6);
				expect(data).to.be.ok;
				expect(data.range).to.eql({start:6, end:11});
				expect(data.iface).to.not.have.property('blah');
				expect(data.iface).to.have.property('name').eql('joe');
				expect(data.iface).to.not.have.property('favorite food');
				expect(data.iface).to.not.have.property('pet');
				expect(data.iface).to.have.property('height').eql('1234');
			});
		});

		describe('_currentFromInterfaces', function() {
			it('retrieves the first interface with a profile', function() {
				var lines = `
				blah: blah
				Name: bob
				
				name: joe
				Profile: beer palace        				
				
				name: kim
				Profile: 1234
				pet: dog
				`.split('\n');

				var iface = sut._currentFromInterfaces(lines);
				expect(iface).to.be.ok;
				expect(iface).to.not.have.property('blah');
				expect(iface).to.not.have.property('pet');
				expect(iface).to.have.property('name').eql('joe');
				expect(iface).to.have.property('profile').eql('beer palace');
			})
		});
	});

	describe('currentInterface', function() {
		function assertCurrent(response, current) {
			var cmd = 'netsh wlan show interfaces'.split(' ');
			var executor = sinon.stub().returns(Promise.resolve(response));
			var sut = new Connector(executor);
			return sut.currentInterface().then((result) => {
				expect(result).to.eql(current);
				expect(executor).to.have.been.calledWith(cmd);
			});
		}

		it('returns null when there are no interfaces', function () {
			var response = 'There is 0 interface on the system';
			return assertCurrent(response, null);
		});

		it('returns null when the interface is not connected', function () {
			var response = `There is 1 interface on the system:

    Name                   : WiFi
    Description            : D-Link DWA-132 Wireless N USB Adapter(rev.B)
    GUID                   : b023475e-7b92-4714-9cb2-0d15bc7c182b
    Physical address       : 78:54:2e:df:1b:01
    State                  : disconnected
    Radio status           : Hardware On
                             Software On

    Hosted network status  : Not available`;

			return assertCurrent(response, null);
		});

		it('returns the 2nd interface when the first interface is disconnected', function () {
			const response = `
				Name                   : no more Mr Wi-Fi
				State                  : disconnected
				Name                   : no more Mr Wi-Fi 2
				State                  : connected
				Profile                : profileName`;
			return assertCurrent(response, {'name' : 'no more Mr Wi-Fi 2', 'state' : 'connected', 'profile' : 'profileName' });
		});

		it('returns the profile name of the first interface when an interface is not specified', function () {
			const response = `
				Name                   : no more Mr Wi-Fi
				State                  : connected
				Profile                : profile name 1
				Name                   : no more Mr Wi-Fi 2
				State                  : connected
				Profile                : profile name 2`;
			return assertCurrent(response, {'name' : 'no more Mr Wi-Fi', 'state' : 'connected', 'profile' : 'profile name 1' });
		});

		// todo - allow the interface name to be specified
	});

	describe('current', function() {
		it('returns the current profile when defined', function() {
			sut.currentInterface = sinon.stub().resolves({name:'beer', profile:'Beer'});
			expect(sut.current()).to.eventually.eql('Beer');
		});

		it('returns undefined when no current network interface', function() {
			sut.currentInterface = sinon.stub().resolves({});
			expect(sut.current()).to.eventually.eql(undefined);
		});
	});

	describe('_buildProfile', function() {
		it('builds a profile with the name and ssid equal', function() {
			var expected = `<?xml version="1.0"?>
			<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
			<name>Photon-8QNP</name>
			<SSIDConfig>
			<SSID>
			<name>Photon-8QNP</name>
			</SSID>
			</SSIDConfig>
			<connectionType>ESS</connectionType>
			<connectionMode>manual</connectionMode>
			<MSM>
			<security>
			<authEncryption>
			<authentication>open</authentication>
			<encryption>none</encryption>
			<useOneX>false</useOneX>
			</authEncryption>
			</security>
			</MSM>
			</WLANProfile>`.replace(/\s+/g, ' ');
			var name = 'Photon-8QNP';

			var result = new Connector()._buildProfile(name);
			expect(result).to.be.equal(expected);
		});
	});

	describe('connect', function() {
		var interfaceName = 'blah';
		var profile = 'foo';

		it('invokes a pipeline of functions', function() {
			var profiles = [ 'a', 'b', profile ];
			sut.currentInterface = sinon.stub().resolves(interfaceName);
			sut._checkHasInterface = sinon.stub().resolves(interfaceName);
			sut.listProfiles = sinon.stub().resolves(profiles);
			sut._createProfileIfNeeded = sinon.stub().resolves(profile);
			sut._connectProfile = sinon.stub().resolves('ok');

			return sut.connect(profile)
				.then(function() {
					expect(sut.currentInterface).to.have.been.calledOnce;
					expect(sut._checkHasInterface).to.have.been.calledWith(interfaceName);
					expect(sut.listProfiles).to.have.been.calledWith(interfaceName);
					expect(sut._createProfileIfNeeded).to.have.been.calledWith(profile, interfaceName, profiles);
					expect(sut._connectProfile).to.have.been.calledWith(profile, interfaceName);
				});
		});

		it('creates a new profile for the given interface if it does not exist', function() {
			sut._execWiFiCommand = sinon.stub();
			var profiles = [];
			sut.currentInterface = sinon.stub().resolves(interfaceName);
			sut._checkHasInterface = sinon.stub().resolves(interfaceName);
			sut.listProfiles = sinon.stub().resolves(profiles);
			sut._createProfile = sinon.stub().resolves();
			sut._connectProfile = sinon.stub().resolves('ok');
			return sut.connect(profile)
				.then(function() {
					expect(sut._createProfile).to.have.been.calledWith(profile, interfaceName);
					expect(sut._connectProfile).to.have.been.calledWith(profile, interfaceName);
				});
		});

		it('connects to the network when a profile already exists', function() {
			sut._execWiFiCommand = sinon.stub();
			var profiles = [profile];
			sut.currentInterface = sinon.stub().resolves(interfaceName);
			sut._checkHasInterface = sinon.stub().resolves(interfaceName);
			sut.listProfiles = sinon.stub().resolves(profiles);
			sut._createProfile = sinon.stub().resolves();
			sut._connectProfile = sinon.stub().resolves('ok');
			return sut.connect(profile)
				.then(function() {
					expect(sut._createProfile).to.not.have.been.called;
					expect(sut._connectProfile).to.have.been.calledWith(profile, interfaceName);
				});
		});
	});

	describe('_connectProfile', function() {
		it('runs netsh wlan connect', function() {
			sut._execWiFiCommand = sinon.stub().resolves('');
			var profile = 'blah';
			var iface = 'may contain spaces';
			sut._connectProfile(profile, iface);
			expect(sut._execWiFiCommand).to.be.calledWith(['connect', 'name=blah', 'interface=may contain spaces']);
		});
	});

	describe('_createProfileIfNeeded', function() {
		it('skips creation when it already exists and returns the profile name', function() {
			sut._createProfile = sinon.stub();
			var profile = 'blah', iface = 'foo', profiles = ['a', profile];
			var result = sut._createProfileIfNeeded(profile, iface, profiles);
			expect(result).to.eql(profile);
			expect(sut._createProfile).to.not.have.been.called;
		});

		it('creates the profile when it does not exist and returns the created profile', function() {
			sut._createProfile = sinon.stub().returns(123);
			var profile = 'blah', iface = 'foo', profiles = ['a'];
			var result = sut._createProfileIfNeeded(profile, iface, profiles);
			expect(result).to.eql(123);
			expect(sut._createProfile).to.have.been.calledWith(profile, iface);
		});
	});

	describe('_profileExists', function() {
		it('returns false when the profile does not exist', function() {
			expect(sut._profileExists('abcd', ['blah', 'foo'])).to.be.eql(false);
		});

		it('returns true when the profile does exist', function() {
			expect(sut._profileExists('abcd', ['blah', 'abcd', 'foo'])).to.be.eql(true);
		});
	});

	describe('_createProfile', function() {
		var fs;
		var profile = 'myprofile';
		var profileContent = 'blah';
		var filename = "_wifi_profile.xml";
		var response = "Profile blah is added on interface Some Interface";
		beforeEach(function() {
			fs = {
				writeFileSync: sinon.stub(),
				unlinkSync: sinon.stub()
			};
		});

		it('writes the profile to disk and runs metsh wlan add profile', function() {
			sut._execWiFiCommand = sinon.stub().resolves(response);
			sut._buildProfile = sinon.stub().returns(profileContent);
			return sut._createProfile(profile, undefined, fs).then(function() {
				expect(sut._buildProfile).to.have.been.calledWith(profile);
				expect(fs.writeFileSync).to.have.been.calledWith(filename, profileContent);
				expect(sut._execWiFiCommand).to.have.been.calledWith(['add', 'profile', 'filename=_wifi_profile.xml']);
				expect(fs.unlinkSync).to.have.been.calledWith(filename);
			});
		});

		it('propagates errors from the wifi command', function() {
			sut._execWiFiCommand = sinon.stub().rejects(1);
			return expect(sut._createProfile(profile, undefined, fs)).to.eventually.be.rejected;
		});

		it('unlinks the file when an error occurs', function() {
			var error = Error('it is tuesday');
			var errorRaised = false;
			sut._execWiFiCommand = sinon.stub().rejects(error);
			sut._buildProfile = sinon.stub().returns(profileContent);
			return sut._createProfile(profile, undefined, fs)
				.catch(function(err) {
					expect(err).to.eql(error);
					errorRaised = true;
				})
				.then(function() {
				expect(sut._buildProfile).to.have.been.calledWith(profile);
				expect(fs.writeFileSync).to.have.been.calledWith(filename, profileContent);
				expect(sut._execWiFiCommand).to.have.been.calledWith(['add', 'profile', 'filename=_wifi_profile.xml']);
				expect(fs.unlinkSync).to.have.been.calledWith(filename);
				expect(errorRaised).to.be.eql(true);
			});
		});

		it('adds the interface to the command when specified', function() {
			sut._execWiFiCommand = sinon.stub().resolves();
			sut._buildProfile = sinon.stub().returns(profileContent);
			const ifaceName = 'myface';
			return sut._createProfile(profile, ifaceName, fs).then(function() {
				expect(sut._buildProfile).to.have.been.calledWith(profile);
				expect(fs.writeFileSync).to.have.been.calledWith(filename, profileContent);
				expect(sut._execWiFiCommand).to.have.been.calledWith(['add', 'profile', 'filename=_wifi_profile.xml', 'interface='+ifaceName]);
				expect(fs.unlinkSync).to.have.been.calledWith(filename);
			});
		});
	});

	describe('listProfiles', function() {
		var list = 'profiles for interface:\nuser profile: profile 1\nuser profile: profile 2';
		var noProfiles = 'no profiles for interface';

		it('calls show profiles interface=ifaceName when an interface is specified', function() {
			sut._execWiFiCommand = sinon.stub().resolves('');
			return sut.listProfiles("abcd").
			then(function () {
				expect(sut._execWiFiCommand).to.have.been.calledWith(['show', 'profiles', 'interface=abcd']);
			});
		});

		it('calls show profiles when no interface is specified', function() {
			sut._execWiFiCommand = sinon.stub().resolves('');
			return sut.listProfiles().
			then(function () {
				expect(sut._execWiFiCommand).to.have.been.calledWith(['show', 'profiles']);
			});
		});

		it('it parses the profiles', function() {
			sut._execWiFiCommand = sinon.stub().resolves(list);
			return sut.listProfiles().
			then(function (profiles) {
				expect(profiles).to.eql(['profile 1', 'profile 2']);
			});
		});
	});

	describe('_checkHasInterface', function() {
		var msg = 'no Wi-Fi interface detected';
		it('raises an error when the interface is falsey', function() {
			function fn() {
				return sut._checkHasInterface();
			}
			expect(fn).to.throw(Error, msg);
		});

		it('raises an error when the interface has no name', function() {
			function fn() {
				return sut._checkHasInterface( { ssid: 'abcd' });
			}
			expect(fn).to.throw(Error, msg);
		});

		it('returns the interface name on success', function() {
			expect(sut._checkHasInterface( { ssid: 'abcd', name: 'foo' })).to.eql('foo');
		});
	});

	describe('module connect', function() {
		it('retrieves the ssid from the options and calls connect', function(done) {
			sut.connect = sinon.stub().resolves({ssid:'abcd2'});
			function cb(err, iface) {
				expect(err).to.be.eql(null);
				expect(iface).to.be.eql({ssid:'abcd2'});
				expect(sut.connect).to.have.been.calledWith('abcd');
				done();
			}
			windowsWiFi.connect({ssid:'abcd'}, cb, sut);
		});

		it('calls the handler with error', function(done) {
			var error = new Error('I do like Mondays');
			sut.connect = sinon.stub().rejects(error);
			function cb(err, iface) {
				expect(err).to.be.eql(error);
				expect(iface).to.be.eql(undefined);
				expect(sut.connect).to.have.been.calledWith('abcd');
				done();
			}
			windowsWiFi.connect({ssid:'abcd'}, cb, sut);
		});
	});

	describe('module getCurrentNetwork', function() {
		it('retrieves the current network via current()', function(done) {
			sut.current = sinon.stub().resolves('abcd2');
			function cb(err, ssid) {
				expect(err).to.be.eql(null);
				expect(ssid).to.be.eql('abcd2');
				expect(sut.current).to.have.been.calledWith();
				done();
			}
			windowsWiFi.getCurrentNetwork(cb, sut);
		});

		it('calls the handler with error', function(done) {
			var error = new Error('I do like Mondays');
			sut.current = sinon.stub().rejects(error);
			function cb(err, ssid) {
				expect(err).to.be.eql(error);
				expect(ssid).to.be.eql(undefined);
				expect(sut.current).to.have.been.calledWith();
				done();
			}
			windowsWiFi.getCurrentNetwork(cb, sut);
		});
	});

	describe('_connectProfile', function() {
		it('returns the ssid', function() {
			sut._execWiFiCommand = sinon.stub().resolves();
			sut.waitForConnected = sinon.stub().resolves();
			return sut._connectProfile('abcd', 'iface')
				.then(function (result) {
					expect(result).to.eql({ssid:'abcd'});
					expect(sut._execWiFiCommand).to.have.been.calledWith(['connect', 'name=abcd', 'interface=iface']);
					expect(sut.waitForConnected).to.have.been.calledWith('abcd', 'iface', 20, 500);
				});
		});
	});

	describe('waitForConnected', () => {
		it('timees out when the network never reaches the given value', () => {
			sut.current = sinon.stub().resolves(undefined);
			return expect(sut.waitForConnected('abcd', 'iface', 2, 1)).to.eventually.be.rejectedWith(Error, /timeout/);
		});

		it('returns the ssid when the network  reaches the given value', () => {
			sut.current = sinon.stub().resolves('abcd');
			return expect(sut.waitForConnected('abcd', 'iface', 2, 1)).to.eventually.be.equal('abcd');
		});
	});
});
