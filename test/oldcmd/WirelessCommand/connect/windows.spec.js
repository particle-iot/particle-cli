'use strict';

const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(sinonChai);
chai.use(chaiAsPromised);


const expect = chai.expect;
require('sinon-as-promised');

const connector = require('../../../../commands/WirelessCommand/connect/windows.js');
var Connector = connector.Connector;

describe('Windows wifi', function() {
	describe('asCallback', function() {
		it('handles success', function() {
			var value = 123;

			function handler(err, data) {
				expect(data).to.be.eql(value);
				expect(err).to.be.not.ok;
			}
			return connector.asCallback(Promise.resolve(value), handler);
		});

		it('handles rejection', function() {
			var rejection = 'My hat is too big';

			function handler(err, data) {
				expect(err).to.be.eql(rejection);
				expect(data).to.be.undefined;
			}
			return connector.asCallback(Promise.reject(rejection), handler);
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
		var sut;

		beforeEach(function() {
			sut = new Connector(sinon.stub().throws('don\'t push me'));
		});

		describe('_stringToLines', function() {
			it('converts all kinds of line endings', function() {
				var s = `one\ntwo\r\nthree\r\n\n\n\n`;
				var lines = sut._stringToLines(s);
				expect(lines).to.be.eql(['one', 'two', 'three']);
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
			var sut = new Connector();
			sut.currentInterface = sinon.stub().resolves({name:'beer', profile:'Beer'});
			expect(sut.current()).to.eventually.eql('Beer');
		});

		it('returns undefined when no current network interface', function() {
			var sut = new Connector();
			sut.currentInterface = sinon.stub().resolves({});
			expect(sut.current()).to.eventually.eql(undefined);
		});
	});

	describe('connect', function() {
		it('', function() {

		});
	});
});