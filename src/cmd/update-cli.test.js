const { expect, sinon } = require('../../test/setup');
const UpdateCLI = require('./update-cli');
const settings = require('../../settings');
const fs = require('fs-extra');
const path = require('path');
const nock = require('nock');
const log = require('../lib/log');
const pkg = require('../../package');
const os = require('os');

describe('Update CLI Command', () => {
	beforeEach(() => {
		sinon.stub(settings, 'saveProfileData');
		settings.profile_json = { enableUpdates: false };
	});

	afterEach(() => {
		sinon.restore();
	});

	describe('updateCli', () => {
		beforeEach(() => {
			sinon.stub(log, 'info');
		});
		afterEach(() => {
			sinon.restore();
		});
		it('skip update if the CLI is up to date', async () => {
			const update = new UpdateCLI();
			const manifest = { version: '1.2.3' };
			sinon.stub(update, 'downloadManifest').resolves(manifest);
			sinon.stub(pkg, 'version').value('1.2.3');
			await update.updateCli();
			expect(log.info).to.have.been.calledWith('CLI is already up to date');
		});

		it('update the CLI to the latest version', async () => {
			const update = new UpdateCLI();
			const manifest = { version: '1.2.3' };
			sinon.stub(update, 'downloadManifest').resolves(manifest);
			sinon.stub(pkg, 'version').value('1.2.2');
			sinon.stub(update, 'downloadCLI').resolves('/path/to/cli/particle-cli-1.2.3-linux-x64.gz');
			sinon.stub(update, 'replaceCLI').resolves();
			await update.updateCli();
			expect(log.info).to.have.been.calledWith('CLI updated successfully');
			expect(settings.saveProfileData).to.have.property('callCount', 1);
			expect(settings.profile_json.last_version_check).to.gt(0);
			expect(update.downloadCLI).to.have.been.calledWith(manifest);
			expect(update.replaceCLI).to.have.been.calledWith('/path/to/cli/particle-cli-1.2.3-linux-x64.gz');
		});
	});
	describe('enable/disable updates', () => {
		it('should enable updates', async () => {
			const update = new UpdateCLI();
			await update.update({ 'enable-updates': true });
			expect(settings.saveProfileData).to.have.property('callCount', 1);
			expect(settings.profile_json.enableUpdates).to.equal(true);
		});

		it('should disable updates', async () => {
			settings.profile_json.enableUpdates = true;
			const update = new UpdateCLI();
			await update.update({ 'disable-updates': true });
			expect(settings.saveProfileData).to.have.property('callCount', 1);
			expect(settings.profile_json.enableUpdates).to.equal(false);
		});
	});

	describe('downloadManifest', () => {
		const manifestData = JSON.stringify({
			'version': '4.1.0',
			'builds': {
				'linux': { 'x64': { 'url': 'https://binaries.particle.io/cli/manifest/4.1.0/particle-cli-4.1.0-linux-x64.tar.gz' }
				}
			}
		});
		beforeEach(() => {
			sinon.stub(log, 'info');
			sinon.stub(log, 'error');
		});
		afterEach(() => {
			sinon.restore();
		});
		it('downloads the latest manifest version', async () => {
			nock('https://binaries.particle.io')
				.intercept('/particle-cli/manifest.json', 'GET')
				.reply(200, manifestData);
			const update = new UpdateCLI();
			const manifest = await update.downloadManifest();
			expect(manifest).to.deep.equal(JSON.parse(manifestData));
		});

		it('downloads a specific manifest version', async () => {
			nock('https://binaries.particle.io')
				.intercept('/particle-cli/manifest-4.1.0.json', 'GET')
				.reply(200, manifestData);
			const update = new UpdateCLI();
			const manifest = await update.downloadManifest('4.1.0');
			expect(manifest).to.deep.equal(JSON.parse(manifestData));
		});
		it('throws an error if the manifest download fails', async () => {
			nock('https://binaries.particle.io')
				.intercept('/particle-cli/manifest.json', 'GET')
				.reply(404);
			const update = new UpdateCLI();
			await expect(update.downloadManifest()).to.be.rejectedWith('We were unable to check for updates Please try again later');
			expect(log.error).to.have.been.calledWith('Failed to download manifest: Status Code 404');
		});
		it('throws an error if the manifest is invalid', async () => {
			nock('https://binaries.particle.io')
				.intercept('/particle-cli/manifest.json', 'GET')
				.reply(200, 'invalid json');
			const update = new UpdateCLI();
			await expect(update.downloadManifest()).to.be.rejectedWith('We were unable to check for updates Please try again later');
			expect(log.error).to.have.been.calledWith('Unexpected token i in JSON at position 0');
		});
	});

	describe('downloadCLI', () => {
		beforeEach(() => {
			sinon.stub(log, 'error');
			sinon.stub(log, 'debug');
		});
		afterEach(() => {
			sinon.restore();
		});
		it('downloads the CLI binary', async () => {
			const update = new UpdateCLI();
			const buildDetails = {
				url: 'https://binaries.particle.io/cli/manifest/1.2.3/particle-cli-1.2.3-linux-x64.gz',
				sha256: '9cb63cb779e8c571db3199b783a36cc43cd9e7c076beeb496c39e9cc06196dc5'
			};
			sinon.stub(update, 'getBuildDetailsFromManifest').returns(buildDetails);
			sinon.stub(update, 'unzipFile').resolves('/path/to/cli/particle-cli-1.2.3-linux-x64.gz');

			nock('https://binaries.particle.io')
				.intercept('/cli/manifest/1.2.3/particle-cli-1.2.3-linux-x64.gz', 'GET')
				.reply(200, 'binary data');
			const cliPath = await update.downloadCLI(buildDetails);
			expect(cliPath).to.contain('particle-cli-1.2.3-linux-x64.gz');
			expect(log.error).to.not.have.been.called;
		});

		it('throws an error if the CLI download fails', async () => {
			const update = new UpdateCLI();
			const buildDetails = {
				url: 'https://binaries.particle.io/cli/manifest/1.2.3/particle-cli-1.2.3-linux-x64.gz',
				sha256: '9cb63cb779e8c571db3199b783a36cc43cd9e7c076beeb496c39e9cc06196dc5'
			};
			sinon.stub(update, 'getBuildDetailsFromManifest').returns(buildDetails);
			sinon.stub(update, 'unzipFile').resolves('/path/to/cli/particle-cli-1.2.3-linux-x64.gz');

			nock('https://binaries.particle.io')
				.intercept('/cli/manifest/1.2.3/particle-cli-1.2.3-linux-x64.gz', 'GET')
				.reply(404);
			await expect(update.downloadCLI(buildDetails)).to.be.rejectedWith('Failed to download or verify the CLI, please try again later');
			expect(log.debug).to.have.been.calledWith('Failed during download or verification: Error: No file found to download');
		});

		it('throws an error if the CLI hash does not match', async () => {
			const update = new UpdateCLI();
			const buildDetails = {
				url: 'https://binaries.particle.io/cli/manifest/1.2.3/particle-cli-1.2.3-linux-x64.gz',
				sha256: 'invalid-hash'
			};
			sinon.stub(update, 'getBuildDetailsFromManifest').returns(buildDetails);
			sinon.stub(update, 'unzipFile').resolves('/path/to/cli/particle-cli-1.2.3-linux-x64.gz');

			nock('https://binaries.particle.io')
				.intercept('/cli/manifest/1.2.3/particle-cli-1.2.3-linux-x64.gz', 'GET')
				.reply(200, 'binary data');
			await expect(update.downloadCLI(buildDetails)).to.be.rejectedWith('Failed to download or verify the CLI, please try again later');
			expect(log.debug).to.have.been.calledWith('Failed during download or verification: Error: Hash mismatch');
		});
	});

	describe('getBuildDetailsFromManifest', () => {
		const manifest = {
			builds: {
				linux: {
					x64: {
						url: 'https://binaries.particle.io/cli/manifest/1.2.3/particle-cli-1.2.3-linux-x64.gz'
					}
				},
				darwin: {
					x64: {
						url: 'https://binaries.particle.io/cli/manifest/1.2.3/particle-cli-1.2.3-darwin-x64.gz'
					},
					arm64: {
						url: 'https://binaries.particle.io/cli/manifest/1.2.3/particle-cli-1.2.3-darwin-arm64.gz'
					}
				},
				win32: {
					x64: {
						url: 'https://binaries.particle.io/cli/manifest/1.2.3/particle-cli-1.2.3-win32-x64.gz'
					}
				}
			}
		};
		const _os = {
			platform: sinon.stub().returns('darwin'),
			arch: sinon.stub().returns('unknown')
		};
		afterEach(() => {
			sinon.restore();
		});
		it('returns the manifest details from current platform/architecture', () => {
			const update = new UpdateCLI();
			const buildDetails = update.getBuildDetailsFromManifest(manifest);
			expect(buildDetails).to.equal(manifest.builds[os.platform()][os.arch()]);
		});

		it('throws an error if the platform is not found in the manifest', () => {
			const update = new UpdateCLI();
			expect(() => update.getBuildDetailsFromManifest(manifest, _os)).to.throw('No CLI build found for darwin unknown');
		});

		it('throws an error if the platform is not found in the manifest', () => {
			const update = new UpdateCLI();
			expect(() => update.getBuildDetailsFromManifest({})).to.throw(`No CLI build found for ${os.platform()} ${os.arch()}`);
		});

	});

	describe('replaceCLI', () => {
		let processExecPathTmp;
		beforeEach(() => {
			processExecPathTmp = process.execPath;
			process.execPath = path.join(path.sep,'usr','bin','particle');
		});

		afterEach(() => {
			process.execPath = processExecPathTmp;
		});


		it('replace the cli for a new one', async () => {
			const update = new UpdateCLI();
			const newCliPath = path.join(path.sep, 'path', 'to', 'new', 'cli');
			const execPath = path.join(path.sep, 'usr', 'bin', 'particle');
			const binPath = path.join(path.sep, 'usr', 'bin');
			const fileName = 'particle';


			const getBinaryPathStub = sinon.spy(update, 'getBinaryPath');
			const moveStub = sinon.stub(fs, 'move').resolves();
			const chmodStub = sinon.stub(fs, 'chmod').resolves();
			const cliPath = execPath;
			const oldCliPath = path.join(binPath, `${fileName}.old`);
			await update.replaceCLI(newCliPath);
			expect(getBinaryPathStub).to.have.been.calledOnce;
			expect(moveStub).to.have.been.calledWith(execPath, oldCliPath, { overwrite: true });
			expect(moveStub).to.have.been.calledWith(newCliPath, cliPath);
			expect(chmodStub).to.have.been.calledWith(cliPath, 0o755);
		});
	});

	describe('configureProfileSettings', () => {
		it ('disable updates if version is provided', async() => {
			const update = new UpdateCLI();
			settings.profile_json.last_version_check = 0;
			settings.profile_json.enableUpdates = true;
			await update.configureProfileSettings('1.2.3');
			expect(settings.profile_json.last_version_check).to.gt(0);
			expect(settings.profile_json.enableUpdates).to.equal(false);
			expect(settings.saveProfileData).to.have.property('callCount', 2);
		});

		it ('update last_version_check but will not change enableUpdates data if version is undefined', async () => {
			const update = new UpdateCLI();
			settings.profile_json.last_version_check = 0;
			settings.profile_json.enableUpdates = true;
			await update.configureProfileSettings();
			expect(settings.profile_json.last_version_check).to.gt(0);
			expect(settings.profile_json.enableUpdates).to.equal(true);
			expect(settings.saveProfileData).to.have.property('callCount', 1);
		});
	});
});
