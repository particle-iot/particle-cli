const { expect } = require('../../test/setup');
const commandProcessor = require('../app/command-processor');
const cloud = require('./cloud');


describe('Cloud Command-Line Interface', () => {
	let root;

	beforeEach(() => {
		root = commandProcessor.createAppCategory();
		cloud({ root, commandProcessor });
	});

	describe('Top-Level `cloud` Namespace', () => {
		it('Handles `cloud` command', () => {
			const argv = commandProcessor.parse(root, ['cloud']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.equal(undefined);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Access Particle cloud functionality',
					'Usage: particle cloud <command>',
					'Help:  particle help cloud <command>',
					'',
					'Commands:',
					'  list     Display a list of your devices, as well as their variables and functions',
					'  claim    Register a device with your user account with the cloud',
					'  remove   Release a device from your account so that another user may claim it',
					'  name     Give a device a name!',
					'  flash    Pass a binary, source file, or source directory to a device!',
					'  compile  Compile a source file, or directory using the cloud compiler',
					'  nyan     Make your device shout rainbows',
					'  login    Login to the cloud and store an access token locally',
					'  logout   Log out of your session and clear your saved access token',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud list` Namespace', () => {
		it('Handles `list` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'list']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filter: undefined });
		});

		it('Parses optional arguments', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'list', 'photon']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ filter: 'photon' });
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'list', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Display a list of your devices, as well as their variables and functions',
					'Usage: particle cloud list [options] [filter]',
					'',
					'Param filter can be: online, offline, a platform name (core, photon, p1, electron, argon, boron, xenon, esomx, bsom, b5som, tracker, trackerm, p2, msom, electron2, tachyon), a device ID or name',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud claim` Namespace', () => {
		it('Handles `claim` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'claim', '1234']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ deviceID: '1234' });
		});

		it('Errors when required `deviceID` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'claim']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'deviceID\' is required.');
			expect(argv.clierror).to.have.property('data', 'deviceID');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'claim', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Register a device with your user account with the cloud',
					'Usage: particle cloud claim [options] <deviceID>',
					'',
					'Examples:',
					'  particle cloud claim 123456789  Claim device by id to your account',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud remove` Namespace', () => {
		it('Handles `remove` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'remove', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device' });
			expect(argv.yes).to.equal(false);
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'remove']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'device\' is required.');
			expect(argv.clierror).to.have.property('data', 'device');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
			expect(argv.yes).to.equal(false);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'remove', 'my-device', '--yes']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device' });
			expect(argv.yes).to.equal(true);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'remove', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Release a device from your account so that another user may claim it',
					'Usage: particle cloud remove [options] <device>',
					'',
					'Options:',
					'  --yes  Answer yes to all questions  [boolean]',
					'',
					'Examples:',
					'  particle cloud remove 0123456789ABCDEFGHI  Remove device by id from your account',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud name` Namespace', () => {
		it('Handles `name` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'name', 'my-device', 'my-device-name']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', name: 'my-device-name' });
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'name']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'device\' is required.');
			expect(argv.clierror).to.have.property('data', 'device');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Errors when required `name` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'name', 'my-device']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'name\' is required.');
			expect(argv.clierror).to.have.property('data', 'name');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({ device: 'my-device' });
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'name', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Give a device a name!',
					'Usage: particle cloud name [options] <device> <name>',
					'',
					'Examples:',
					'  particle cloud name red green  Rename device `red` to `green`',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud flash` Namespace', () => {
		it('Handles `flash` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'flash', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', files: [] });
			expect(argv.followSymlinks).to.equal(false);
			expect(argv.target).to.equal(undefined);
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'flash']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'device\' is required.');
			expect(argv.clierror).to.have.property('data', 'device');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
			expect(argv.followSymlinks).to.equal(false);
			expect(argv.target).to.equal(undefined);
		});

		it('Parses optional params', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'flash', 'my-device', 'blink.ino']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', files: ['blink.ino'] });
			expect(argv.followSymlinks).to.equal(false);
			expect(argv.target).to.equal(undefined);
		});

		it('Parses options', () => {
			const args = ['cloud', 'flash', 'my-device', '--followSymlinks', '--target', '2.0.0', '--product', '12345'];
			const argv = commandProcessor.parse(root, args);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', files: [] });
			expect(argv.followSymlinks).to.equal(true);
			expect(argv.target).to.equal('2.0.0');
			expect(argv.product).to.equal('12345');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'flash', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Pass a binary, source file, or source directory to a device!',
					'Usage: particle cloud flash [options] <device> [files...]',
					'',
					'Options:',
					'  --target          The firmware version to compile against. Defaults to latest version, or version on device for cellular.  [string]',
					'  --followSymlinks  Follow symlinks when collecting files  [boolean]',
					'  --product         Target a device within the given Product ID or Slug  [string]',
					'',
					'Examples:',
					'  particle cloud flash blue                                      Compile the source code in the current directory in the cloud and flash to device `blue`',
					'  particle cloud flash green tinker                              Flash the default `tinker` app to device `green`',
					'  particle cloud flash red blink.ino                             Compile `blink.ino` in the cloud and flash to device `red`',
					'  particle cloud flash orange firmware.bin                       Flash a pre-compiled `firmware.bin` binary to device `orange`',
					'  particle cloud flash 0123456789abcdef01234567 --product 12345  Compile the source code in the current directory in the cloud and flash to device `0123456789abcdef01234567` within product `12345`',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud compile` Namespace', () => {
		it('Handles `compile` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'compile', 'argon']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ deviceType: 'argon', files: [] });
			expect(argv.target).to.equal(undefined);
			expect(argv.followSymlinks).to.equal(false);
			expect(argv.saveTo).to.equal(undefined);
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'compile']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'deviceType\' is required.');
			expect(argv.clierror).to.have.property('data', 'deviceType');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
			expect(argv.target).to.equal(undefined);
			expect(argv.followSymlinks).to.equal(false);
			expect(argv.saveTo).to.equal(undefined);
		});

		it('Parses optional params', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'compile', 'argon', 'blink.ino']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ deviceType: 'argon', files: ['blink.ino'] });
			expect(argv.target).to.equal(undefined);
			expect(argv.followSymlinks).to.equal(false);
			expect(argv.saveTo).to.equal(undefined);
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'compile', 'argon', 'blink.ino', '--followSymlinks', '--target', '2.0.0', '--saveTo', './path/to/my.bin']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ deviceType: 'argon', files: ['blink.ino'] });
			expect(argv.target).to.equal('2.0.0');
			expect(argv.followSymlinks).to.equal(true);
			expect(argv.saveTo).to.equal('./path/to/my.bin');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'compile', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Compile a source file, or directory using the cloud compiler',
					'Usage: particle cloud compile [options] <deviceType> [files...]',
					'',
					'Options:',
					'  --target          The firmware version to compile against. Defaults to latest version, or version on device for cellular.  [string]',
					'  --followSymlinks  Follow symlinks when collecting files  [boolean]',
					'  --saveTo          Filename for the compiled binary  [string]',
					'',
					'Examples:',
					'  particle cloud compile photon                                  Compile the source code in the current directory in the cloud for a `photon`',
					'  particle cloud compile electron project --saveTo electron.bin  Compile the source code in the project directory in the cloud for an `electron` and save it to a file named `electron.bin`',
					'',
					'Param deviceType can be: core, c, photon, p, p1, electron, e, argon, a, boron, b, xenon, x, esomx, bsom, b5som, tracker, assettracker, trackerm, p2, photon2, msom, muon, electron2, tachyon',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud nyan` Namespace', () => {
		it('Handles `nyan` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'nyan', 'my-device']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', onOff: undefined });
		});

		it('Errors when required `device` argument is missing', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'nyan']);
			expect(argv.clierror).to.be.an.instanceof(Error);
			expect(argv.clierror).to.have.property('message', 'Parameter \'device\' is required.');
			expect(argv.clierror).to.have.property('data', 'device');
			expect(argv.clierror).to.have.property('isUsageError', true);
			expect(argv.params).to.eql({});
		});

		it('Parses optional params', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'nyan', 'my-device', 'off']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', onOff: 'off' });
		});

		it('Parses options', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'nyan', 'my-device', '--product', '12345']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({ device: 'my-device', onOff: undefined });
			expect(argv.product).to.equal('12345');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'nyan', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Make your device shout rainbows',
					'Usage: particle cloud nyan [options] <device> [onOff]',
					'',
					'Options:',
					'  --product  Target a device within the given Product ID or Slug  [string]',
					'',
					'Examples:',
					'  particle cloud nyan blue                  Make the device named `blue` start signaling',
					'  particle cloud nyan blue off              Make the device named `blue` stop signaling',
					'  particle cloud nyan blue --product 12345  Make the device named `blue` within product `12345` start signaling',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud login` Namespace', () => {
		it('Handles `login` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'login']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv.username).to.equal(undefined);
			expect(argv.password).to.equal(undefined);
			expect(argv.token).to.equal(undefined);
			expect(argv.otp).to.equal(undefined);
		});

		it('Parses options', () => {
			const cmd = ['cloud', 'login', '--username', 'user@example.com', '--password', 'fake-password', '--token', 'fake-token', '--otp', '01234'];
			const argv = commandProcessor.parse(root, cmd);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv.username).to.equal('user@example.com');
			expect(argv.password).to.equal('fake-password');
			expect(argv.token).to.equal('fake-token');
			expect(argv.otp).to.equal('01234');
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'login', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Login to the cloud and store an access token locally',
					'Usage: particle cloud login [options]',
					'',
					'Options:',
					'  -u, --username  your username  [string]',
					'  -p, --password  your password  [string]',
					'  -t, --token     an existing Particle access token to use  [string]',
					'  --sso           Enterprise sso login  [boolean]',
					'  --otp           the login code if two-step authentication is enabled  [string]',
					'',
					'Examples:',
					'  particle cloud login                                              prompt for credentials and log in',
					'  particle cloud login --username user@example.com --password test  log in with credentials provided on the command line',
					'  particle cloud login --token <my-api-token>                       log in with an access token provided on the command line',
					'  particle cloud login --sso                                        log in with Enterprise sso',
					''
				].join('\n'));
			});
		});
	});

	describe('`cloud logout` Namespace', () => {
		it('Handles `logout` command', () => {
			const argv = commandProcessor.parse(root, ['cloud', 'logout']);
			expect(argv.clierror).to.equal(undefined);
			expect(argv.params).to.eql({});
			expect(argv.username).to.equal(undefined);
			expect(argv.password).to.equal(undefined);
			expect(argv.token).to.equal(undefined);
			expect(argv.otp).to.equal(undefined);
		});

		it('Includes help', () => {
			const termWidth = null; // don't right-align option type labels so testing is easier
			commandProcessor.parse(root, ['cloud', 'logout', '--help'], termWidth);
			commandProcessor.showHelp((helpText) => {
				expect(helpText).to.equal([
					'Log out of your session and clear your saved access token',
					'Usage: particle cloud logout [options]',
					''
				].join('\n'));
			});
		});
	});
});

