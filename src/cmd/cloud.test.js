const proxyquire = require('proxyquire');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { expect } = require('../../test/setup');
const sandbox = require('sinon').createSandbox();
const { PATH_FIXTURES_THIRDPARTY_OTA_DIR, PATH_TMP_DIR } = require('../../test/lib/env');

const stubs = {
	api: {
		login: () => {},
		sendOtp: () => {},
		getUser: () => {}
	},
	utils: {},
	prompts: {
		getCredentials: () => {},
		getOtp: () => {}
	},
	settings: {
		clientId: 'CLITESTS',
		username: 'test@example.com',
		override: () => {}
	},
	ApiClient: function ApiClient(){
		return stubs.api;
	}
};

const CloudCommands = proxyquire('./cloud', {
	'../../settings': stubs.settings,
	'../lib/utilities': stubs.utils,
	'../lib/api-client': stubs.ApiClient,
	'../lib/prompts': stubs.prompts
});


describe('Cloud Commands', () => {
	let fakeToken, fakeTokenResponse, fakeCredentials, fakeUser;
	let fakeMfaToken, fakeOtp, fakeOtpError;

	beforeEach(() => {
		fakeToken = 'FAKE-ACCESS-TOKEN';
		fakeTokenResponse = { access_token: fakeToken };
		fakeCredentials = { username: 'test@example.com', password: 'fake-pw' };
		fakeUser = { username: 'test@example.com' };
		fakeMfaToken = 'abc1234';
		fakeOtp = '123456';
		fakeOtpError = { error: 'mfa_required', mfa_token: fakeMfaToken };
	});

	afterEach(() => {
		sandbox.restore();
	});

	describe('login', () => {
		it('accepts token arg', withConsoleStubs(() => {
			const { cloud, api, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username } = fakeCredentials;
			api.getUser.resolves(fakeUser);

			return cloud.login({ token: fakeToken })
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(api.login).to.have.property('callCount', 0);
					expect(api.getUser).to.have.property('callCount', 1);
					expect(api.getUser.firstCall.args).to.eql([fakeToken]);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('accepts username and password args', withConsoleStubs(() => {
			const { cloud, api, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username, password } = fakeCredentials;
			api.login.resolves(fakeTokenResponse);

			return cloud.login({ username, password })
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(api.login).to.have.property('callCount', 1);
					expect(api.login.firstCall).to.have.property('args').lengthOf(3);
					expect(api.login.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.login.firstCall.args[1]).to.equal(username);
					expect(api.login.firstCall.args[2]).to.equal(password);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('prompts for username and password when they are not provided', withConsoleStubs(() => {
			const { cloud, api, prompts, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username, password } = fakeCredentials;
			prompts.getCredentials.returns(fakeCredentials);
			api.login.resolves(fakeTokenResponse);

			return cloud.login()
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(prompts.getCredentials).to.have.property('callCount', 1);
					expect(cloud.ui.showBusySpinnerUntilResolved).to.have.property('callCount', 1);
					expect(api.login).to.have.property('callCount', 1);
					expect(api.login.firstCall).to.have.property('args').lengthOf(3);
					expect(api.login.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.login.firstCall.args[1]).to.equal(username);
					expect(api.login.firstCall.args[2]).to.equal(password);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('does not retry after 3 attemps', withConsoleStubs(() => {
			const { cloud, api, prompts, settings } = stubForLogin(new CloudCommands(), stubs);
			prompts.getCredentials.returns(fakeCredentials);
			api.login.throws();

			return cloud.login()
				.then(() => {
					throw new Error('expected promise to be rejected');
				})
				.catch(error => {
					const stdoutArgs = process.stdout.write.args;
					const lastLog = stdoutArgs[stdoutArgs.length - 1];

					expect(cloud.login).to.have.property('callCount', 3);
					expect(settings.override).to.have.property('callCount', 0);
					expect(lastLog[0]).to.match(new RegExp(`There was an error logging you in! Let's try again.${os.EOL}$`));
					expect(process.stderr.write).to.have.property('callCount', 3);
					expect(error).to.have.property('message', 'It seems we\'re having trouble with logging in.');
				});
		}));

		it('does not retry when username & password args are provided', withConsoleStubs(() => {
			const { cloud, api, settings } = stubForLogin(new CloudCommands(), stubs);
			api.login.throws();

			return cloud.login({ username: 'username', password: 'password' })
				.then(() => {
					throw new Error('expected promise to be rejected');
				})
				.catch(error => {
					const stdoutArgs = process.stdout.write.args;
					const lastLog = stdoutArgs[stdoutArgs.length - 1];

					expect(cloud.login).to.have.property('callCount', 1);
					expect(settings.override).to.have.property('callCount', 0);
					expect(lastLog[0]).to.match(new RegExp(`There was an error logging you in! ${os.EOL}$`));
					expect(process.stderr.write).to.have.property('callCount', 1);
					expect(error).to.have.property('message', 'It seems we\'re having trouble with logging in.');
				});
		}));
	});

	describe('login with mfa', () => {
		it('accepts username, password and otp args', withConsoleStubs(() => {
			const { cloud, api, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username, password } = fakeCredentials;
			api.login.rejects(fakeOtpError);
			api.sendOtp.resolves(fakeTokenResponse);

			return cloud.login({ username, password, otp: fakeOtp })
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(api.login).to.have.property('callCount', 1);
					expect(api.login.firstCall).to.have.property('args').lengthOf(3);
					expect(api.login.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.login.firstCall.args[1]).to.equal(username);
					expect(api.login.firstCall.args[2]).to.equal(password);
					expect(api.sendOtp).to.have.property('callCount', 1);
					expect(api.sendOtp.firstCall).to.have.property('args').lengthOf(3);
					expect(api.sendOtp.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.sendOtp.firstCall.args[1]).to.equal(fakeMfaToken);
					expect(api.sendOtp.firstCall.args[2]).to.equal(fakeOtp);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('prompts for username, password and otp when they are not provided', withConsoleStubs(() => {
			const { cloud, api, prompts, settings } = stubForLogin(new CloudCommands(), stubs);
			const { username, password } = fakeCredentials;
			prompts.getCredentials.returns(fakeCredentials);
			prompts.getOtp.returns(fakeOtp);
			api.login.rejects(fakeOtpError);
			api.sendOtp.resolves(fakeTokenResponse);

			return cloud.login()
				.then(t => {
					expect(t).to.equal(fakeToken);
					expect(prompts.getCredentials).to.have.property('callCount', 1);
					expect(prompts.getOtp).to.have.property('callCount', 1);
					expect(cloud.ui.showBusySpinnerUntilResolved).to.have.property('callCount', 2);
					expect(api.login).to.have.property('callCount', 1);
					expect(api.login.firstCall).to.have.property('args').lengthOf(3);
					expect(api.login.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.login.firstCall.args[1]).to.equal(username);
					expect(api.login.firstCall.args[2]).to.equal(password);
					expect(api.sendOtp).to.have.property('callCount', 1);
					expect(api.sendOtp.firstCall).to.have.property('args').lengthOf(3);
					expect(api.sendOtp.firstCall.args[0]).to.equal(stubs.settings.clientId);
					expect(api.sendOtp.firstCall.args[1]).to.equal(fakeMfaToken);
					expect(api.sendOtp.firstCall.args[2]).to.equal(fakeOtp);
					expect(settings.override).to.have.property('callCount', 2);
					expect(settings.override.firstCall.args).to.eql([null, 'access_token', fakeToken]);
					expect(settings.override.secondCall.args).to.eql([null, 'username', username]);
				});
		}));

		it('does not retry after 3 attemps', withConsoleStubs(() => {
			const { cloud, api, prompts, settings } = stubForLogin(new CloudCommands(), stubs);
			prompts.getCredentials.returns(fakeCredentials);
			prompts.getOtp.returns(fakeOtp);
			api.login.rejects(fakeOtpError);
			api.sendOtp.throws();

			return cloud.login()
				.then(() => {
					throw new Error('expected promise to be rejected');
				})
				.catch(error => {
					const stdoutArgs = process.stdout.write.args;
					const lastLog = stdoutArgs[stdoutArgs.length - 1];

					expect(cloud.login).to.have.property('callCount', 1);
					expect(cloud.enterOtp).to.have.property('callCount', 3);
					expect(settings.override).to.have.property('callCount', 0);
					expect(lastLog[0]).to.match(new RegExp(`There was an error logging you in! Let's try again.${os.EOL}$`));
					expect(process.stderr.write).to.have.property('callCount', 4);
					expect(error).to.have.property('message', 'It seems we\'re having trouble with logging in.');
				});
		}));
	});

	function stubForLogin(cloud, stubs){
		const { api, prompts, settings } = stubs;
		sandbox.spy(cloud, 'login');
		sandbox.spy(cloud, 'enterOtp');
		sandbox.stub(cloud.ui, 'showBusySpinnerUntilResolved').callsFake((_, p) => p);
		sandbox.stub(api, 'login');
		sandbox.stub(api, 'sendOtp');
		sandbox.stub(api, 'getUser');
		sandbox.stub(prompts, 'getCredentials');
		sandbox.stub(prompts, 'getOtp');
		sandbox.stub(settings, 'override');
		return { cloud, api, prompts, settings };
	}

	// TODO (mirande): figure out a better approach. this allows us to verify
	// log output without supressing mocha's success / error messages but is a
	// bit awkward
	function withConsoleStubs(fn){

		return () => {
			let result;

			sandbox.stub(process.stdout, 'write');
			sandbox.stub(process.stderr, 'write');

			try {
				result = fn();
			} catch (error) {
				sandbox.restore();
				throw error;
			}

			if (result && typeof result.finally === 'function'){
				return result.finally(() => sandbox.restore());
			}
			sandbox.restore();
			return result;
		};
	}

	describe('_checkForAssets', () => {
		it('returns path to assets folder', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const dirPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid');
			expect(await cloud._checkForAssets([dirPath])).to.equal(path.join(dirPath, 'assets'));
		});

		it('returns undefined if assets folder is missing', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const dirPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_no_assets');
			expect(await cloud._checkForAssets([dirPath])).to.equal(undefined);
		});
	});

	describe('_getDownloadPathForBin', () => {
		it('returns default name if saveTo is not provided', () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const res = cloud._getDownloadPathForBin('argon', undefined);
			expect(res).to.match(/argon_firmware_\d+.bin/);
		});

		it('returns saveTo.bin', () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const res = cloud._getDownloadPathForBin('argon', 'myApp.bin');
			expect(res).to.equal('myApp.bin');
		});

		it('returns myApp.bin if myApp is provided', () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const res = cloud._getDownloadPathForBin('argon', 'myApp');
			expect(res).to.equal('myApp');
		});

		it('returns myApp.bin if myApp.txt is provided', () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const res = cloud._getDownloadPathForBin('argon', 'myApp.txt');
			expect(res).to.equal('myApp.txt');
		});
	});

	describe('_getBundleSavePath', () => {
		it('returns undefined if assets are not provided', () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const res = cloud._getBundleSavePath('argon');
			expect(res).to.equal(undefined);
		});

		it('returns default name if saveTo is not provided', () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const assets = 'fakeAssets';
			const res = cloud._getBundleSavePath('argon', undefined, assets);
			expect(res).to.match(/argon_firmware_\d+.zip/);
		});

		it('returns saveTo.zip if assets are present', () => {
			const assets = 'fakeAssets';
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const res = cloud._getBundleSavePath('argon', 'myApp.zip', assets);
			expect(res).to.equal('myApp.zip');
		});

		it('returns error if saveTo does not have .zip extension', () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			const assets = 'fakeAssets';
			let error;

			try {
				cloud._getBundleSavePath('argon', 'myApp', assets);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'saveTo must have a .zip extension when project includes assets');
		});
	});

	describe('_processDirIncludes', () => {
		it('gets the list of files', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h'
			], {}, async (dir) => {
				const fileMapping = { basePath: dir, map: {} };

				await cloud._processDirIncludes(fileMapping, dir);

				expect(fileMapping.map).to.eql({
					[path.join('src/app.cpp')]: path.join('src/app.cpp'),
					[path.join('lib/spi/src/spi.c')]: path.join('lib/spi/src/spi.c'),
					[path.join('lib/spi/src/spi.h')]: path.join('lib/spi/src/spi.h')
				});
			});
		});

		it('gets the list of files with include and ignore configs', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'src/app.def',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/spi/src/spi.def',
				'lib/spi/src/spi.cmd',
				'lib/spi/examples/sensor/spi_example.cpp',
				'lib/spi/examples/sensor/spi_example.h',
				'lib/spi/particle.include',
				'lib/i2c/src/i2c.c',
				'lib/i2c/particle.ignore'
			], {
				'particle.include': '**/*.def',
				'lib/spi/particle.include': '**/*.cmd',
				'lib/i2c/particle.ignore': '**/*.c'
			}, async (dir) => {
				const fileMapping = { basePath: dir, map: {} };

				await cloud._processDirIncludes(fileMapping, dir);

				expect(fileMapping.map).to.eql({
					[path.join('src/app.cpp')]: path.join('src/app.cpp'),
					[path.join('src/app.def')]: path.join('src/app.def'),
					[path.join('lib/spi/src/spi.c')]: path.join('lib/spi/src/spi.c'),
					[path.join('lib/spi/src/spi.h')]: path.join('lib/spi/src/spi.h'),
					[path.join('lib/spi/src/spi.def')]: path.join('lib/spi/src/spi.def'),
					[path.join('lib/spi/src/spi.cmd')]: path.join('lib/spi/src/spi.cmd')
				});
			});
		});

		it('does not return files that are not included', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/spi/src/spi.txt'
			], {}, async (dir) => {
				const fileMapping = { basePath: dir, map: {} };

				await cloud._processDirIncludes(fileMapping, dir);

				expect(fileMapping.map).to.eql({
					[path.join('src/app.cpp')]: path.join('src/app.cpp'),
					[path.join('lib/spi/src/spi.c')]: path.join('lib/spi/src/spi.c'),
					[path.join('lib/spi/src/spi.h')]: path.join('lib/spi/src/spi.h')
				});
			});
		});

		it('returns files that are included', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/spi/src/spi.txt',
				'lib/particle.include'
			], {
				'lib/particle.include': '**/*.txt'
			}, async (dir) => {
				const fileMapping = { basePath: dir, map: {} };

				await cloud._processDirIncludes(fileMapping, dir);

				expect(fileMapping.map).to.eql({
					[path.join('src/app.cpp')]: path.join('src/app.cpp'),
					[path.join('lib/spi/src/spi.c')]: path.join('lib/spi/src/spi.c'),
					[path.join('lib/spi/src/spi.h')]: path.join('lib/spi/src/spi.h'),
					[path.join('lib/spi/src/spi.txt')]: path.join('lib/spi/src/spi.txt')
				});
			});
		});

		it('removes duplicates if included multiple times', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/spi/src/spi.txt',
				'lib/particle.include'
			], {
				'particle.include': '**/*.cpp',
				'lib/particle.include': '**/*.txt'
			}, async (dir) => {
				const fileMapping = { basePath: dir, map: {} };

				await cloud._processDirIncludes(fileMapping, dir);

				expect(fileMapping.map).to.eql({
					[path.join('src/app.cpp')]: path.join('src/app.cpp'),
					[path.join('lib/spi/src/spi.c')]: path.join('lib/spi/src/spi.c'),
					[path.join('lib/spi/src/spi.h')]: path.join('lib/spi/src/spi.h'),
					[path.join('lib/spi/src/spi.txt')]: path.join('lib/spi/src/spi.txt')
				});
			});
		});

		it('removes files which are in ignore list', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.ignore',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/spi/src/spi.txt',
				'lib/particle.include'
			], {
				'particle.ignore': '**/*.cpp',
				'lib/particle.include': '**/*.txt'
			}, async (dir) => {
				const fileMapping = { basePath: dir, map: {} };

				await cloud._processDirIncludes(fileMapping, dir);

				expect(fileMapping.map).to.eql({
					[path.join('lib/spi/src/spi.c')]: path.join('lib/spi/src/spi.c'),
					[path.join('lib/spi/src/spi.h')]: path.join('lib/spi/src/spi.h'),
					[path.join('lib/spi/src/spi.txt')]: path.join('lib/spi/src/spi.txt')
				});
			});
		});
	});

	describe('_getDefaultIncludes', () => {
		it('gets the list of files to include by default', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'src/app.ino',
				'src/app.cpp',
				'src/app.hpp',
				'src/app.hh',
				'src/app.hxx',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/spi/src/build.mk'
			], {}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getDefaultIncludes(files, dir, {});

				expect([...files]).to.have.same.members([
					path.resolve(dir, 'src/app.ino'),
					path.resolve(dir, 'src/app.cpp'),
					path.resolve(dir, 'src/app.hpp'),
					path.resolve(dir, 'src/app.hh'),
					path.resolve(dir, 'src/app.hxx'),
					path.resolve(dir, 'lib/spi/src/spi.c'),
					path.resolve(dir, 'lib/spi/src/spi.h'),
					path.resolve(dir, 'lib/spi/src/build.mk')
				]);
			});
		});

		it('filters out files which are not in the default blob', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'src/app.txt',
				'lib/spi/src/spi.txt',
			], {}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getDefaultIncludes(files, dir, {} );

				expect([...files]).to.have.same.members([
					path.resolve(dir, 'src/app.cpp'),
					path.resolve(dir, 'lib/spi/src/spi.c'),
					path.resolve(dir, 'lib/spi/src/spi.h')
				]);
			});
		});
	});

	describe('_getCustomIncludes', () => {
		it('gets the list of files to include via particle.include', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'src/app.def'
			], { 'particle.include': '**/*.def' }, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIncludes(files, dir, {} );

				expect([...files]).to.have.same.members([
					path.resolve(dir, 'src/app.def')
				]);
			});
		});

		it('gets the list of nested files to include via particle.include', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'src/app.def',
				'src/file.txt',
				'src/particle.include',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h'
			], {
				'particle.include': '**/*.def',
				'src/particle.include': '**/*.txt\n**/*.def'
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIncludes(files, dir, {} );

				expect([...files]).to.have.same.members([
					path.resolve(dir, 'src/app.def'),
					path.resolve(dir, 'src/file.txt')
				]);
			});
		});

		it('gets the list of files from nested directories', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'src/app.def',
				'lib/particle.include',
				'lib/file.txt',
				'lib/file.def',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h'
			], {
				'particle.include': '**/*.def',
				'lib/particle.include': '**/*.txt\n**/*.def'
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIncludes(files, dir, {} );

				expect([...files]).to.have.same.members([
					path.resolve(dir, 'src/app.def'),
					path.resolve(dir, 'lib/file.txt'),
					path.resolve(dir, 'lib/file.def')
				]);
			});
		});

		it('handles repeated files from nested directories', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'src/app.def',
				'lib/particle.include',
				'lib/file.txt',
				'lib/file.def',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h'
			], {
				'particle.include': '**/*.def',
				'lib/particle.include': '**/*.txt\n**/*.def'
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIncludes(files, dir, {} );

				expect([...files]).to.have.same.members([
					path.resolve(dir, 'src/app.def'),
					path.resolve(dir, 'lib/file.txt'),
					path.resolve(dir, 'lib/file.def')
				]);
			});
		});

		it('handles an empty particle.include', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'src/app.def'
			], {}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIncludes(files, dir, {} );

				expect([...files]).to.be.empty;
			});
		});

		it('handles empty particle.include in a nested dir', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'src/app.def',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/particle.include'
			], {
				'particle.include': '**/*.def',
				'lib/particle.include': ''
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIncludes(files, dir, {} );

				expect([...files]).to.have.same.members([
					path.resolve(dir, 'src/app.def')
				]);
			});
		});

		it('handles multiple empty particle.include files', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'src/app.def',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/particle.include'
			], {
				'particle.include': '',
				'lib/particle.include': ''
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIncludes(files, dir, {} );

				expect([...files]).to.be.empty;
			});
		});

		it('should not error if files are not found', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.include',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
			], {
				'particle.include': '**/*.def',
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIncludes(files, dir, {} );

				expect([...files]).to.be.empty;
			});
		});
	});

	describe('_getDefaultIgnores', () => {
		it('gets the list of files to ignore', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/spi/examples/sensor/init.ino'
			], {}, async (dir) => {
				dir = path.resolve(dir);
				// hardcode a set with 'lib/spi/examples/sensor/init.ino'
				let files = new Set([
					path.join(dir, 'lib/spi/examples/sensor/init.ino')
				]);

				cloud._getDefaultIgnores(files, dir, {} );

				expect([...files]).to.be.empty;
			});
		});
	});

	describe('_getCustomIgnores', () => {
		it('gets the list of files to ignore', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.ignore',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
			], {
				'particle.ignore': '**/*.cpp',
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set([
					path.join(dir, 'src/app.cpp')
				]);

				cloud._getCustomIgnores(files, dir, {} );

				expect([...files]).to.be.empty;
			});
		});

		it('handles multiple particle.ignore files', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.ignore',
				'lib/particle.ignore',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
			], {
				'particle.ignore': '**/*.cpp',
				'lib/particle.ignore': '**/*.h',
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set([
					path.join(dir, 'src/app.cpp'),
					path.join(dir, 'lib/spi/src/spi.h')
				]);

				cloud._getCustomIgnores(files, dir, {} );

				expect([...files]).to.be.empty;
			});
		});

		it('handles an empty particle.ignore', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.ignore',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
			], {
				'particle.ignore': '',
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set();

				cloud._getCustomIgnores(files, dir, {} );

				expect([...files]).to.be.empty;
			});
		});

		it('handles empty particle.ignore in a nested dir', async () => {
			const { cloud } = stubForLogin(new CloudCommands(), stubs);
			await createTmpDir([
				'particle.ignore',
				'src/app.cpp',
				'lib/spi/src/spi.c',
				'lib/spi/src/spi.h',
				'lib/particle.ignore'
			], {
				'particle.ignore': '**/*.cpp',
				'lib/particle.ignore': ''
			}, async (dir) => {
				dir = path.resolve(dir);
				let files = new Set([
					path.join(dir, 'src/app.cpp')
				]);

				cloud._getCustomIgnores(files, dir, {} );

				expect([...files]).to.be.empty;
			});
		});
	});

	async function createTmpDir(files, fileContents, handler) {
		const tmpDir = path.join(PATH_TMP_DIR, 'tmpDir');
		await fs.mkdir(tmpDir);
		for (const file of files) {
			const filePath = path.join(tmpDir, file);
			await fs.outputFile(filePath, fileContents[file] || '');
		}

		try {
			await handler(tmpDir);
		} finally {
			await fs.remove(tmpDir);
		}
	}
});

