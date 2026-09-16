'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../test/setup');
const { TachyonConnectionError } = require('../lib/qdl');

let getEDLDevice;
let getTachyonInfo;
let lookupCloudDeviceInfo;
let handleFlashError;
let readManifestFromLocalFile;
let workflowRun;
let baseDir;

const tachyonUtils = {
	getEDLDevice: (...args) => getEDLDevice(...args),
	getTachyonInfo: (...args) => getTachyonInfo(...args),
	lookupCloudDeviceInfo: (...args) => lookupCloudDeviceInfo(...args),
	handleFlashError: (...args) => handleFlashError(...args),
	readManifestFromLocalFile: (...args) => readManifestFromLocalFile(...args)
};

const { workflows: workflowFixtures } = require('../lib/tachyon/workflow');

const settings = {
	ensureFolder: () => baseDir,
	tachyonVersion: 'stable',
	profile_json: { country: 'USA' },
	isStaging: false
};

const SetupTachyonCommand = proxyquire('./setup-tachyon', {
	'../lib/tachyon-utils': tachyonUtils,
	'../lib/tachyon/workflow': {
		workflows: workflowFixtures,
		workflowRun: (...args) => workflowRun(...args)
	},
	'../lib/api-call': {
		getCurrentUsername: sinon.stub().resolves('test@example.com')
	},
	'../../settings': settings
});

function fakeUi() {
	const identity = (value) => value;
	return {
		prompt: sinon.stub(),
		write: sinon.stub(),
		stdout: { write: sinon.stub() },
		showBusySpinnerUntilResolved: sinon.stub().callsFake((_text, promise) => promise),
		chalk: {
			bold: Object.assign(identity, { white: identity }),
			yellow: identity
		}
	};
}

describe('SetupTachyonCommand', () => {
	let command;
	let ui;
	const device = {
		id: '422a060000000000d0c7965f',
		serialNumber: 'D0C7965F',
		usbVersion: { major: 3, minor: 2 }
	};

	beforeEach(async () => {
		baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tachyon-setup-'));
		ui = fakeUi();
		getEDLDevice = sinon.stub().resolves(device);
		getTachyonInfo = sinon.stub();
		lookupCloudDeviceInfo = sinon.stub().resolves(null);
		handleFlashError = sinon.stub().resolves(false);
		readManifestFromLocalFile = sinon.stub();
		workflowRun = sinon.stub().resolves({});
		command = new SetupTachyonCommand({ ui });
		command.device = device;
		sinon.stub(command.downloadManager, 'fetchManifest').callsFake(async ({ version }) => ({
			builds: Object.values(workflowFixtures)
				.filter(wf => version !== 'stable' || ['ubuntu20', 'ubuntu24'].includes(wf.value))
				.map(wf => ({
					distribution: wf.osInfo.distribution,
					distribution_version: wf.osInfo.distributionVersion,
					region: 'NA', board: 'formfactor_dvt'
				}))
		}));
	});

	afterEach(async () => {
		await fs.remove(baseDir);
		sinon.restore();
	});

	it('infers QLI from a local image manifest', async () => {
		readManifestFromLocalFile.resolves({ distribution: 'qualcomm-linux', distribution_version: '2.0' });
		const workflow = await command._selectWorkflow({ isLocalVersion: true, version: '/tmp/qli.zip' });
		expect(workflow).to.equal(workflowFixtures.qli20);
	});
	it('uses the same release metadata for every distribution', async () => {
		for (const wf of Object.values(workflowFixtures)) {
			await command._getManifestBuilds({ version: 'latest', osInfo: wf.osInfo });
		}
		for (const call of command.downloadManager.fetchManifest.getCalls()) {
			expect(call.args[0]).to.eql({ version: 'latest' });
		}
	});

	it('offers all four Linux OSes and labels only those without stable releases as Beta', async () => {
		ui.prompt.resolves({ osType: 'ubuntu26' });
		expect(await command._pickWorkflowToExecute()).to.equal(workflowFixtures.ubuntu26);
		const choices = ui.prompt.firstCall.args[0][0].choices;
		expect(choices.map(choice => choice.name)).to.eql([
			'Ubuntu 20.04', 'Ubuntu 24.04', 'Ubuntu 26.04 (Beta)',
			'Qualcomm Linux 2.0 Open (headless) (Beta)', 'Android 14 (Beta)'
		]);
	});

	it('removes the Beta label when a stable release is published', async () => {
		command.downloadManager.fetchManifest.resolves({ builds: [{
			distribution: 'qualcomm-linux', distribution_version: '2.0'
		}] });
		ui.prompt.resolves({ osType: 'qli20' });
		await command._pickWorkflowToExecute();
		const choices = ui.prompt.firstCall.args[0][0].choices;
		expect(choices.find(choice => choice.value === 'qli20').name).not.to.include('(Beta)');
		expect(choices.find(choice => choice.value === 'ubuntu24').name).to.include('(Beta)');
	});

	it('does not interpret a metadata download failure as no stable releases', async () => {
		command.downloadManager.fetchManifest.rejects(new Error('network unavailable'));
		await expect(command._pickWorkflowToExecute()).to.be.rejectedWith('network unavailable');
		expect(ui.prompt).not.to.have.been.called;
	});

	it('uses information read from a recognised existing layout', async () => {
		const expected = {
			deviceId: device.id,
			region: 'NA',
			manufacturingData: 'Found',
			osVersion: 'Ubuntu 20.04',
			board: 'formfactor_dvt'
		};
		getTachyonInfo.resolves(expected);

		expect(await command._getDeviceInfo()).to.equal(expected);
		expect(ui.write).not.to.have.been.calledWithMatch(/Continuing with the identity/);
	});

	it('continues from the EDL identity when the outgoing GPT is unsupported', async () => {
		getTachyonInfo.rejects(new Error('Partition boot_a not found in device partition table'));

		const info = await command._getDeviceInfo();

		expect(info).to.eql({
			deviceId: device.id,
			region: 'Unknown',
			manufacturingData: 'Unknown',
			osVersion: 'Unknown',
			board: 'Unknown'
		});
		expect(ui.write).to.have.been.calledWithMatch(/Continuing with the identity reported in EDL mode/);
		expect(handleFlashError).not.to.have.been.called;
	});

	it('lets setup reach the workflow when identification cannot parse the GPT', async () => {
		getTachyonInfo.rejects(new Error('Failed to parse partition table 0 from device'));
		sinon.stub(command, '_loadConfig').resolves({ workflow: { value: 'ubuntu20' } });

		await command.setup();

		expect(lookupCloudDeviceInfo).to.have.been.calledWith({ deviceId: device.id, api: command.api });
		expect(lookupCloudDeviceInfo).to.have.been.calledBefore(getTachyonInfo);
		expect(workflowRun).to.have.been.calledOnce;
		expect(workflowRun.firstCall.args[1].deviceInfo.deviceId).to.equal(device.id);
		expect(workflowRun.firstCall.args[1].device).to.equal(device);
	});

	it('still stops when the device itself is no longer reachable', async () => {
		getTachyonInfo.rejects(new TachyonConnectionError());
		handleFlashError.resolves({ retry: false });

		await expect(command._getDeviceInfo()).to.be.rejectedWith('Unable to communicate with the device');
	});

	it('retries a connection failure when requested', async () => {
		const expected = {
			deviceId: device.id,
			region: 'NA',
			manufacturingData: 'Found',
			osVersion: 'Ubuntu 20.04',
			board: 'formfactor_dvt'
		};
		getTachyonInfo.onFirstCall().rejects(new TachyonConnectionError());
		getTachyonInfo.onSecondCall().resolves(expected);
		handleFlashError.resolves({ retry: true });

		expect(await command._getDeviceInfo()).to.equal(expected);
		expect(getTachyonInfo).to.have.been.calledTwice;
	});

	it('keeps region and board from a loaded configuration', async () => {
		const filename = path.join(baseDir, 'setup.json');
		await fs.writeJson(filename, { region: 'RoW', board: 'formfactor' });

		expect(await command._loadConfigFromFile(filename)).to.include({
			region: 'RoW',
			board: 'formfactor',
			silent: true,
			loadedFromFile: true
		});
	});

	describe('workflow selection', () => {
		for (const [distroVersion, workflowName] of [['20.04', 'ubuntu20'], ['24.04', 'ubuntu24'], ['26.04', 'ubuntu26'], ['qli-2.0', 'qli20']]) {
			it(`uses explicit distro version ${distroVersion} and skips the OS selection prompt`, async () => {
				const selectInteractively = sinon.stub(command, '_pickWorkflowToExecute');
				sinon.stub(command, '_resolveHardwareOptions').resolves({ region: 'NA', board: 'formfactor_dvt' });
				sinon.stub(command, '_getManifestBuilds').resolves([]);

				const config = await command._loadConfig({
					options: { distroVersion },
					deviceInfo: {},
					cloudInfo: null,
					isLocalVersion: false
				});

				expect(config.workflow).to.equal(workflowFixtures[workflowName]);
				expect(config.distroVersion).to.equal(workflowFixtures[workflowName].osInfo.distributionVersion);
				expect(config.version).to.equal(['20.04', '24.04'].includes(distroVersion) ? 'stable' : 'latest');
				expect(selectInteractively).not.to.have.been.called;
				expect(command._getManifestBuilds).to.have.been.calledWithMatch({
					osInfo: workflowFixtures[workflowName].osInfo
				});
			});
		}

		it('keeps distro metadata aligned with an interactive OS selection', async () => {
			sinon.stub(command, '_pickWorkflowToExecute').resolves(workflowFixtures.ubuntu24);
			sinon.stub(command, '_resolveHardwareOptions').resolves({ region: 'NA', board: 'formfactor_dvt' });
			sinon.stub(command, '_getManifestBuilds').resolves([]);

			const config = await command._loadConfig({
				options: {},
				deviceInfo: {},
				cloudInfo: null,
				isLocalVersion: false
			});

			expect(config.workflow).to.equal(workflowFixtures.ubuntu24);
			expect(config.distroVersion).to.equal('24.04');
		});

		for (const version of ['stable', 'latest', '1.3.1']) {
			it(`respects explicit version ${version} even when the OS has no stable release`, async () => {
				const config = await command._loadConfig({
					options: { distroVersion: '26.04', version, region: 'NA', board: 'formfactor_dvt' },
					deviceInfo: {}, cloudInfo: null, isLocalVersion: false
				});
				expect(config.version).to.equal(version);
				expect(command.downloadManager.fetchManifest).to.have.been.calledOnce;
				expect(command.downloadManager.fetchManifest.firstCall.args[0]).to.eql({ version });
			});
		}

		it('infers Ubuntu 26.04 from a local image without fetching release metadata', async () => {
			readManifestFromLocalFile.resolves({ distribution: 'ubuntu', distribution_version: '26.04' });
			const config = await command._loadConfig({
				options: { version: '/tmp/26.zip', region: 'NA', board: 'formfactor_dvt' },
				deviceInfo: {}, cloudInfo: null, isLocalVersion: true
			});
			expect(config.workflow).to.equal(workflowFixtures.ubuntu26);
			expect(command.downloadManager.fetchManifest).not.to.have.been.called;
		});

		it('rejects the bare 2.0 distro identifier', async () => {
			await expect(command._selectWorkflow({ distroVersion: '2.0' }))
				.to.be.rejectedWith("Unsupported Linux distribution version '2.0'");
		});

		it('accepts the qli-2.0 distro identifier', async () => {
			expect(await command._selectWorkflow({ distroVersion: 'qli-2.0' })).to.equal(workflowFixtures.qli20);
		});

		it('lets an explicit distro version override a loaded workflow', async () => {
			const workflow = await command._selectWorkflow({
				isLocalVersion: false,
				distroVersion: '24.04',
				configFromFile: { workflow: 'ubuntu20' },
				defaultWorkflow: workflowFixtures.ubuntu20
			});

			expect(workflow).to.equal(workflowFixtures.ubuntu24);
		});

		it('rejects an unsupported explicit distro version', async () => {
			await expect(command._selectWorkflow({
				isLocalVersion: false,
				distroVersion: '22.04',
				configFromFile: {},
				defaultWorkflow: workflowFixtures.ubuntu20
			})).to.be.rejectedWith("Unsupported Linux distribution version '22.04'");
		});

		it('rejects a distro version that conflicts with a local image', async () => {
			readManifestFromLocalFile.resolves({
				distribution: 'ubuntu',
				distribution_version: '20.04'
			});

			await expect(command._selectWorkflow({
				isLocalVersion: true,
				version: '/tmp/tachyon-ubuntu-20.04.zip',
				distroVersion: '24.04',
				configFromFile: {},
				defaultWorkflow: workflowFixtures.ubuntu20
			})).to.be.rejectedWith("does not match the local image distribution version '20.04'");
		});
	});

	describe('hardware option precedence', () => {
		const local = { region: 'NA', board: 'formfactor_dvt' };
		const cloud = { region: 'RoW', board: null };

		beforeEach(() => {
			sinon.stub(command, '_selectRegion').resolves('prompt-region');
			sinon.stub(command, '_selectBoard').resolves('prompt-board');
		});

		it('prefers command-line values over every discovered value', async () => {
			const result = await command._resolveHardwareOptions({
				options: { region: 'RoW', board: 'rb3g2' },
				configFromFile: { region: 'NA', board: 'formfactor' },
				deviceInfo: local,
				cloudInfo: cloud
			});

			expect(result).to.eql({ region: 'RoW', board: 'rb3g2' });
			expect(command._hardwareOptionSources).to.eql({ region: 'command line', board: 'command line' });
		});

		it('prefers loaded configuration over device and cloud values', async () => {
			const result = await command._resolveHardwareOptions({
				options: {},
				configFromFile: { region: 'RoW', board: 'formfactor' },
				deviceInfo: local,
				cloudInfo: cloud
			});

			expect(result).to.eql({ region: 'RoW', board: 'formfactor' });
			expect(command._hardwareOptionSources).to.eql({ region: 'loaded configuration', board: 'loaded configuration' });
		});

		it('prefers readable device values over cloud values', async () => {
			const result = await command._resolveHardwareOptions({
				options: {},
				configFromFile: {},
				deviceInfo: local,
				cloudInfo: cloud
			});

			expect(result).to.eql(local);
			expect(command._hardwareOptionSources).to.eql({ region: 'device', board: 'device' });
		});

		it('uses cloud region and prompts for a board the cloud does not report', async () => {
			const result = await command._resolveHardwareOptions({
				options: {},
				configFromFile: {},
				deviceInfo: { region: 'Unknown', board: 'Unknown' },
				cloudInfo: cloud
			});

			expect(result).to.eql({ region: 'RoW', board: 'prompt-board' });
			expect(command._selectRegion).not.to.have.been.called;
			expect(command._selectBoard).to.have.been.calledOnce;
			expect(command._hardwareOptionSources).to.eql({ region: 'Particle Cloud', board: 'user input' });
		});

		it('prompts instead of silently defaulting when no source knows', async () => {
			const result = await command._resolveHardwareOptions({
				options: {},
				configFromFile: {},
				deviceInfo: { region: 'Unknown', board: 'Unknown' },
				cloudInfo: null
			});

			expect(result).to.eql({ region: 'prompt-region', board: 'prompt-board' });
			expect(command._selectRegion).to.have.been.calledOnce;
			expect(command._selectBoard).to.have.been.calledOnce;
			expect(command._hardwareOptionSources).to.eql({ region: 'user input', board: 'user input' });
		});
	});
});
