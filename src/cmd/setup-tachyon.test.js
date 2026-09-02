'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../test/setup');
const { TachyonConnectionError } = require('../lib/qdl');

let getEDLDevice;
let getTachyonInfo;
let handleFlashError;
let workflowRun;
let baseDir;

const tachyonUtils = {
	getEDLDevice: (...args) => getEDLDevice(...args),
	getTachyonInfo: (...args) => getTachyonInfo(...args),
	handleFlashError: (...args) => handleFlashError(...args)
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
		workflows: { ubuntu20: { value: 'ubuntu20' } },
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
		handleFlashError = sinon.stub().resolves(false);
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
			board: 'formfactor_dvt'
		});
		expect(ui.write).to.have.been.calledWithMatch(/Continuing with the identity reported in EDL mode/);
	});

	it('lets setup reach the workflow when identification cannot parse the GPT', async () => {
		getTachyonInfo.rejects(new Error('Failed to parse partition table 0 from device'));
		sinon.stub(command, '_loadConfig').resolves({ workflow: { value: 'ubuntu20' } });

		await command.setup();

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
});
