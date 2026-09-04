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

const workflowFixtures = {
	ubuntu20: {
		value: 'ubuntu20',
		osInfo: { distribution: 'ubuntu', distributionVersion: '20.04' }
	},
	ubuntu24: {
		value: 'ubuntu24',
		osInfo: { distribution: 'ubuntu', distributionVersion: '24.04' }
	},
	android14: {
		value: 'android14',
		osInfo: { distribution: 'android', distributionVersion: '14' }
	}
};

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
		write: sinon.stub(),
		stdout: { write: sinon.stub() },
		showBusySpinnerUntilResolved: sinon.stub().callsFake((_text, promise) => promise),
		chalk: {
			bold: identity,
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
	});

	afterEach(async () => {
		await fs.remove(baseDir);
		sinon.restore();
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
		for (const [distroVersion, workflowName] of [['20.04', 'ubuntu20'], ['24.04', 'ubuntu24']]) {
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
				expect(config.distroVersion).to.equal(distroVersion);
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
