const { expect, sinon } = require('../../../test/setup');
const windowsWiFi = require('./windows');


describe('Windows wifi', () => {
	const sandbox = sinon.createSandbox();
	const { Connector } = windowsWiFi;
	let connector, executor, callback;

	beforeEach(() => {
		// default connector has no executor
		connector = new Connector(sinon.stub().throws('don\'t push me'));
		executor = sandbox.spy(() => Promise.resolve(123));
		callback = sandbox.stub();
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('asCallback', () => {
		it('handles success', async () => {
			const value = 123;

			await windowsWiFi.asCallback(Promise.resolve(value), callback);

			expect(callback).to.have.property('callCount', 1);
			expect(callback.firstCall.args).to.eql([null, value]);
		});

		it('handles rejection', async () => {
			const error = new Error('My hat is too big');

			await windowsWiFi.asCallback(Promise.reject(error), callback);

			expect(callback).to.have.property('callCount', 1);
			expect(callback.firstCall.args).to.eql([error]);
		});
	});

	describe('_exec', () => {
		it('invokes the command executor', async () => {
			const args = ['a', 'b', 'c'];

			await new Connector(executor)._exec(args);

			expect(executor).to.have.been.calledWith(args);
		});
	});

	describe('_execWiFiCommand', () => {
		it('invokes the command executor with a "netsh wlan" prefix', async () => {
			const args = ['a', 'b', 'c'];

			await new Connector(executor)._execWiFiCommand(args);

			expect(executor).to.have.been.calledWith(['netsh', 'wlan', 'a', 'b', 'c']);
		});
	});

	describe('parsing', () => {
		describe('_stringToLines', () => {
			it('converts all kinds of line endings', () => {
				const s = 'one\ntwo\r\nthree\r\n\n\n\n';
				const lines = connector._stringToLines(s);
				expect(lines).to.be.eql(['one', 'two', 'three']);
			});

			it('returns the empty array when there are no lines', () => {
				expect(connector._stringToLines('')).to.be.eql([]);
			});

			it('returns a single line', () => {
				expect(connector._stringToLines('abcd\n')).to.be.eql(['abcd']);
			});
		});

		describe('_keyValue', () => {
			it('returns undefined if no colon', () => {
				const result = connector._keyValue('key value');
				expect(result).to.be.eql(undefined);
			});

			it('splits at the first colon', () => {
				const result = connector._keyValue('key space: value : value 2');
				expect(result).to.have.property('key').eql('key space');
				expect(result).to.have.property('value').eql('value : value 2');
			});

			it('returns the key lowercased, and value in original case', () => {
				const result = connector._keyValue('KeY     :    MY VALUE');
				expect(result).to.have.property('key').eql('key');
				expect(result).to.have.property('value').eql('MY VALUE');
			});

			it('trims external whitespace', () => {
				const result = connector._keyValue('KeY       :    MY VALUE   ');
				expect(result).to.have.property('key').eql('key');
				expect(result).to.have.property('value').eql('MY VALUE');
			});
		});

		describe('_extractInterface', () => {
			it('ignores properties up to the first name', () => {
				const data = connector._extractInterface(`
					blah: blah
					Name: bob
					Favorite food: worms
				`.split('\n'));

				expect(data).to.be.ok;
				expect(data.range).to.eql({ start: 2, end: 5 });
				expect(data.iface).to.not.have.property('blah');
				expect(data.iface).to.have.property('name').eql('bob');
				expect(data.iface).to.have.property('favorite food').eql('worms');
			});

			it('gathers properties up to the next name from the start', () => {
				const data = connector._extractInterface(`
					blah: blah
					Name: bob
					Favorite food: worms
					pet: dogs
					
					name: joe
					height: 1234
				`.split('\n'));

				expect(data).to.be.ok;
				expect(data.range).to.eql({ start: 2, end: 6 });
				expect(data.iface).to.not.have.property('blah');
				expect(data.iface).to.have.property('name').eql('bob');
				expect(data.iface).to.have.property('favorite food').eql('worms');
				expect(data.iface).to.have.property('pet').eql('dogs');
				expect(data.iface).to.not.have.property('height');
			});


			it('gathers properties up to the next name from the index given', () => {
				const lines = `
				blah: blah
				Name: bob
				Favorite food: worms
				pet: dogs
				
				name: joe
				height: 1234
				
				
				`.split('\n');
				const data = connector._extractInterface(lines, 6);

				expect(data).to.be.ok;
				expect(data.range).to.eql({ start: 6, end: 11 });
				expect(data.iface).to.not.have.property('blah');
				expect(data.iface).to.have.property('name').eql('joe');
				expect(data.iface).to.not.have.property('favorite food');
				expect(data.iface).to.not.have.property('pet');
				expect(data.iface).to.have.property('height').eql('1234');
			});
		});

		describe('_currentFromInterfaces', () => {
			it('retrieves the first interface with a profile', () => {
				const lines = `
				blah: blah
				Name: bob
				
				name: joe
				Profile: beer palace        				
				
				name: kim
				Profile: 1234
				pet: dog
				`.split('\n');
				const iface = connector._currentFromInterfaces(lines);

				expect(iface).to.be.ok;
				expect(iface).to.not.have.property('blah');
				expect(iface).to.not.have.property('pet');
				expect(iface).to.have.property('name').eql('joe');
				expect(iface).to.have.property('profile').eql('beer palace');
			});
		});
	});

	describe('currentInterface', () => {
		it('returns null when there are no interfaces', () => {
			const response = 'There is 0 interface on the system';
			return assertCurrent(response, null);
		});

		it('returns null when the interface is not connected', () => {
			const response = `There is 1 interface on the system:

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

		it('returns the 2nd interface when the first interface is disconnected', () => {
			const response = `
				Name                   : no more Mr Wi-Fi
				State                  : disconnected
				Name                   : no more Mr Wi-Fi 2
				State                  : connected
				Profile                : profileName`;

			return assertCurrent(response, {
				name: 'no more Mr Wi-Fi 2',
				state: 'connected',
				profile: 'profileName'
			});
		});

		it('returns the profile name of the first interface when an interface is not specified', () => {
			const response = `
				Name                   : no more Mr Wi-Fi
				State                  : connected
				Profile                : profile name 1
				Name                   : no more Mr Wi-Fi 2
				State                  : connected
				Profile                : profile name 2`;

			return assertCurrent(response, {
				name: 'no more Mr Wi-Fi',
				state: 'connected',
				profile: 'profile name 1'
			});
		});

		async function assertCurrent(response, current){
			const cmd = 'netsh wlan show interfaces'.split(' ');
			const executor = sandbox.spy(() => Promise.resolve(response));
			const result = await new Connector(executor).currentInterface();

			expect(result).to.eql(current);
			expect(executor).to.have.been.calledWith(cmd);
		}
	});

	describe('current', () => {
		beforeEach(() => {
			sandbox.stub(connector, 'currentInterface');
		});

		it('returns the current profile when defined', async () => {
			const iface = { name: 'beer', profile: 'Beer' };
			connector.currentInterface.resolves(iface);
			const profile = await connector.current();

			expect(profile).to.equal(iface.profile);
		});

		it('returns undefined when no current network interface', async () => {
			const iface = {};
			connector.currentInterface.resolves(iface);
			const profile = await connector.current();

			expect(profile).to.equal(undefined);
		});
	});

	describe('_buildProfile', () => {
		it('builds a profile with the name and ssid equal', () => {
			const name = 'Photon-8QNP';
			const expected = `<?xml version="1.0"?>
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

			expect(connector._buildProfile(name)).to.be.equal(expected);
		});
	});

	describe('connect', () => {
		let interfaceName, profile;

		beforeEach(() => {
			profile = 'foo';
			interfaceName = 'blah';
			sandbox.stub(connector, 'currentInterface').resolves(interfaceName);
			sandbox.stub(connector, '_checkHasInterface').resolves(interfaceName);
			sandbox.stub(connector, '_createProfileIfNeeded').resolves(profile);
			sandbox.stub(connector, '_connectProfile').resolves('ok');
			sandbox.stub(connector, '_createProfile').resolves();
			sandbox.stub(connector, '_execWiFiCommand');
			sandbox.stub(connector, 'listProfiles');
		});

		it('invokes a pipeline of functions', async () => {
			const profiles = ['a', 'b', profile];

			connector.listProfiles.resolves(profiles);
			await connector.connect(profile);

			expect(connector.currentInterface).to.have.property('callCount', 1);
			expect(connector._checkHasInterface).to.have.been.calledWith(interfaceName);
			expect(connector.listProfiles).to.have.been.calledWith(interfaceName);
			expect(connector._createProfileIfNeeded).to.have.been.calledWith(profile, interfaceName, profiles);
			expect(connector._connectProfile).to.have.been.calledWith(profile, interfaceName);
		});

		it('creates a new profile for the given interface if it does not exist', async () => {
			const profiles = [];

			connector._createProfileIfNeeded.restore();
			connector.listProfiles.resolves(profiles);
			await connector.connect(profile);

			expect(connector._createProfile).to.have.been.calledWith(profile, interfaceName);
			expect(connector._connectProfile).to.have.been.calledWith(profile, interfaceName);
		});

		it('connects to the network when a profile already exists', async () => {
			const profiles = [profile];

			connector.listProfiles.resolves(profiles);
			await connector.connect(profile);

			expect(connector._createProfile).to.not.have.been.called;
			expect(connector._connectProfile).to.have.been.calledWith(profile, interfaceName);
		});
	});

	describe('_connectProfile', () => {
		beforeEach(() => {
			connector = new Connector(executor);
			sandbox.stub(connector, '_execWiFiCommand').resolves('');
			sandbox.stub(connector, 'waitForConnected').resolves();
		});

		it('runs netsh wlan connect', () => {
			const profile = 'blah';
			const iface = 'may contain spaces';

			connector._connectProfile(profile, iface);

			expect(connector._execWiFiCommand).to.be.calledWith([
				'connect',
				'name=blah',
				'interface=may contain spaces'
			]);
		});
	});

	describe('_createProfileIfNeeded', () => {
		let profile, iface;

		beforeEach(() => {
			sandbox.stub(connector, '_createProfile').returns(123);
			profile = 'blah';
			iface = 'foo';
		});

		it('skips creation when it already exists and returns the profile name', () => {
			const profiles = ['a', profile];
			const result = connector._createProfileIfNeeded(profile, iface, profiles);

			expect(result).to.eql(profile);
			expect(connector._createProfile).to.not.have.been.called;
		});

		it('creates the profile when it does not exist and returns the created profile', () => {
			const profiles = ['a'];
			const result = connector._createProfileIfNeeded(profile, iface, profiles);

			expect(result).to.eql(123);
			expect(connector._createProfile).to.have.been.calledWith(profile, iface);
		});
	});

	describe('_profileExists', () => {
		it('returns false when the profile does not exist', () => {
			expect(connector._profileExists('abcd', ['blah', 'foo'])).to.be.eql(false);
		});

		it('returns true when the profile does exist', () => {
			expect(connector._profileExists('abcd', ['blah', 'abcd', 'foo'])).to.be.eql(true);
		});
	});

	describe('_createProfile', () => {
		let fs, profile, profileContent, filename, response;

		beforeEach(() => {
			profile = 'myprofile';
			profileContent = 'blah';
			filename = '_wifi_profile.xml';
			response = 'Profile blah is added on interface Some Interface';
			sandbox.stub(connector, '_execWiFiCommand').resolves(response);
			sandbox.stub(connector, '_buildProfile').returns(profileContent);
			fs = { writeFileSync: sinon.stub(), unlinkSync: sinon.stub() };
		});

		it('writes the profile to disk and runs metsh wlan add profile', async () => {
			await connector._createProfile(profile, undefined, fs);

			expect(connector._buildProfile).to.have.been.calledWith(profile);
			expect(fs.writeFileSync).to.have.been.calledWith(filename, profileContent);
			expect(connector._execWiFiCommand).to.have.been.calledWith(['add', 'profile', 'filename=_wifi_profile.xml']);
			expect(fs.unlinkSync).to.have.been.calledWith(filename);
		});

		it('propagates errors from the wifi command', async () => {
			connector._execWiFiCommand.rejects(new Error('nope'));
			let error;

			try {
				await connector._createProfile(profile, undefined, fs);
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'nope');
		});

		it('unlinks the file when an error occurs', async () => {
			connector._execWiFiCommand.rejects(new Error('nope'));
			let error;

			try {
				await connector._createProfile(profile, undefined, fs);
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'nope');
			expect(connector._buildProfile).to.have.been.calledWith(profile);
			expect(fs.writeFileSync).to.have.been.calledWith(filename, profileContent);
			expect(connector._execWiFiCommand).to.have.been.calledWith(['add', 'profile', 'filename=_wifi_profile.xml']);
			expect(fs.unlinkSync).to.have.been.calledWith(filename);
		});

		it('adds the interface to the command when specified', async () => {
			const ifaceName = 'myface';

			await connector._createProfile(profile, ifaceName, fs);

			expect(connector._buildProfile).to.have.been.calledWith(profile);
			expect(fs.writeFileSync).to.have.been.calledWith(filename, profileContent);
			expect(connector._execWiFiCommand).to.have.been.calledWith(['add', 'profile', 'filename=_wifi_profile.xml', 'interface='+ifaceName]);
			expect(fs.unlinkSync).to.have.been.calledWith(filename);
		});
	});

	describe('listProfiles', () => {
		let list;

		beforeEach(() => {
			sandbox.stub(connector, '_execWiFiCommand').resolves('');
			list = 'profiles for interface:\nuser profile: profile 1\nuser profile: profile 2';
		});

		it('calls show profiles interface=ifaceName when an interface is specified', async () => {
			await connector.listProfiles('abcd');
			expect(connector._execWiFiCommand).to.have.been.calledWith(['show', 'profiles', 'interface=abcd']);
		});

		it('calls show profiles when no interface is specified', async () => {
			await connector.listProfiles();
			expect(connector._execWiFiCommand).to.have.been.calledWith(['show', 'profiles']);
		});

		it('it parses the profiles', async () => {
			connector._execWiFiCommand.resolves(list);
			const profiles = await connector.listProfiles();
			expect(profiles).to.eql(['profile 1', 'profile 2']);
		});
	});

	describe('_checkHasInterface', () => {
		let msg;

		beforeEach(() => {
			msg = 'no Wi-Fi interface detected';
		});

		it('raises an error when the interface is falsey', () => {
			expect(() => connector._checkHasInterface()).to.throw(Error, msg);
		});

		it('raises an error when the interface has no name', () => {
			expect(() => connector._checkHasInterface({ ssid: 'abcd' })).to.throw(Error, msg);
		});

		it('returns the interface name on success', () => {
			expect(connector._checkHasInterface({ ssid: 'abcd', name: 'foo' })).to.eql('foo');
		});
	});

	describe('module connect', () => {
		let iface;

		beforeEach(() => {
			iface = { ssid:'abcd2' };
			sandbox.stub(connector, 'connect').resolves(iface);
		});

		it('retrieves the ssid from the options and calls connect', async () => {
			const callback = sandbox.stub();

			await windowsWiFi.connect(iface, callback, connector);

			expect(callback).to.have.property('callCount', 1);
			expect(callback.firstCall.args).to.eql([null, iface]);
			expect(connector.connect).to.have.been.calledWith(iface.ssid);
		});

		it('calls the handler with error', async () => {
			const error = new Error('nope');
			const callback = sandbox.stub();

			connector.connect.rejects(error);
			await windowsWiFi.connect(iface, callback, connector);

			expect(callback).to.have.property('callCount', 1);
			expect(callback.firstCall.args).to.eql([error]);
			expect(connector.connect).to.have.been.calledWith(iface.ssid);
		});
	});

	describe('module getCurrentNetwork', () => {
		let ssid;

		beforeEach(() => {
			ssid = 'abcd2';
			sandbox.stub(connector, 'current').resolves(ssid);
		});

		it('retrieves the current network via current()', async () => {
			const callback = sandbox.stub();

			await windowsWiFi.getCurrentNetwork(callback, connector);

			expect(callback).to.have.property('callCount', 1);
			expect(callback.firstCall.args).to.eql([null, ssid]);
			expect(connector.current).to.have.property('callCount', 1);
			expect(connector.current.firstCall.args).to.eql([]);
		});

		it('calls the handler with error', async () => {
			const error = new Error('nope');
			const callback = sandbox.stub();

			connector.current.rejects(error);
			await windowsWiFi.getCurrentNetwork(callback, connector);

			expect(callback).to.have.property('callCount', 1);
			expect(callback.firstCall.args).to.eql([error]);
			expect(connector.current).to.have.property('callCount', 1);
			expect(connector.current.firstCall.args).to.eql([]);
		});
	});

	describe('_connectProfile', () => {
		beforeEach(() => {
			sandbox.stub(connector, 'waitForConnected').resolves();
			sandbox.stub(connector, '_execWiFiCommand').resolves();
		});

		it('returns the ssid', async () => {
			const result = await connector._connectProfile('abcd', 'iface');
			expect(result).to.eql({ ssid:'abcd' });
			expect(connector._execWiFiCommand).to.have.been.calledWith(['connect', 'name=abcd', 'interface=iface']);
			expect(connector.waitForConnected).to.have.been.calledWith('abcd', 'iface', 20, 500);
		});
	});

	describe('waitForConnected', () => {
		beforeEach(() => {
			sandbox.stub(connector, 'current').resolves();
			sandbox.stub(connector, '_execWiFiCommand').resolves();
		});

		it('throws when the network never reaches the given value after retrying', async () => {
			sandbox.spy(connector, 'waitForConnected');
			let error;

			try {
				await connector.waitForConnected('abcd', 'iface', 2, 1);
			} catch (e){
				error = e;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'unable to connect to network abcd');
			expect(connector.waitForConnected).to.have.property('callCount', 2);
			expect(connector.waitForConnected.firstCall.args).to.eql(['abcd', 'iface', 2, 1]);
			expect(connector.waitForConnected.secondCall.args).to.eql(['abcd', 'iface', 1, 1]);
		});

		it('returns the ssid when the network reaches the given value', async () => {
			connector.current.resolves('abcd');
			const ssid = await connector.waitForConnected('abcd', 'iface', 2, 1);
			expect(ssid).to.equal('abcd');
		});
	});
});

