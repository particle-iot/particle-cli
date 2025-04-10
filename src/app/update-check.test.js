const { expect, sinon } = require('../../test/setup');
const updateCheck = require('./update-check');
const settings = require('../../settings');
const childProcess= require('node:child_process');

describe('Update Check', () => {
	const sandbox = sinon.createSandbox();
	const originalProfileJSON = settings.profile_json;
	let fakeUpdateCheckTimeout, fakeUpdateCheckInterval,
		fakeLastVersionCheck;

	beforeEach(() => {
		process.pkg = true;
		fakeUpdateCheckTimeout = 1000;
		fakeUpdateCheckInterval = 0;
		fakeLastVersionCheck = 0;
		settings.profile_json = settings.profile_json || { last_version_check: undefined };
		sandbox.stub(settings, 'saveProfileData');
		sandbox.stub(settings, 'updateCheckInterval').get(() => fakeUpdateCheckInterval);
		sandbox.stub(settings, 'updateCheckTimeout').get(() => fakeUpdateCheckTimeout);
		sandbox.stub(settings.profile_json, 'last_version_check').get(() => fakeLastVersionCheck);
		sandbox.stub(settings.profile_json, 'last_version_check').set((x) => (fakeLastVersionCheck = x));
		sandbox.stub(childProcess, 'spawn').returns({ unref: () => {} });
	});

	afterEach(() => {
		sandbox.restore();
		settings.profile_json = originalProfileJSON;
	});

	it('Checks for latest version', async () => {
		const lastCheck = settings.profile_json.last_version_check;
		const result = await updateCheck();

		expect(result).to.equal(undefined);
		expect(settings.saveProfileData).to.have.property('callCount', 1);
		expect(settings.profile_json.last_version_check).to.be.at.least(lastCheck);
		expect(settings.profile_json).to.not.have.property('newer_version');
		expect(childProcess.spawn).to.have.property('callCount', 1);
		expect(childProcess.spawn.firstCall.args[0]).to.equal(process.execPath);
		expect(childProcess.spawn.firstCall.args[1]).to.include('update-cli');
	});

	it('Checks for latest version when forced', async () => {
		fakeLastVersionCheck = Date.now();
		fakeUpdateCheckInterval = 1000;

		const force = true;
		const lastCheck = settings.profile_json.last_version_check;
		const result = await updateCheck(false, force);

		expect(result).to.equal(undefined);

		expect(settings.saveProfileData).to.have.property('callCount', 1);
		expect(settings.profile_json.last_version_check).to.be.at.least(lastCheck);
		expect(settings.profile_json).to.not.have.property('newer_version');
		expect(childProcess.spawn).to.have.property('callCount', 1);
		expect(childProcess.spawn.firstCall.args[0]).to.equal(process.execPath);
		expect(childProcess.spawn.firstCall.args[1]).to.include('update-cli');
	});

	it('Does nothing when last check was completed within the allotted interval', async () => {
		fakeLastVersionCheck = Date.now();
		fakeUpdateCheckInterval = 1000;
		const result = await updateCheck();

		expect(result).to.equal(undefined);
		expect(settings.saveProfileData).to.have.property('callCount', 0);
		expect(childProcess.spawn).to.have.property('callCount', 0);
	});

	it('just saves the last update time when `skip` flag is set', async () => {
		const skip = true;
		const lastCheck = settings.profile_json.last_version_check;

		const result = await updateCheck(skip);

		expect(result).to.equal(undefined);
		expect(settings.saveProfileData).to.have.property('callCount', 1);
		expect(settings.profile_json.last_version_check).to.be.at.least(lastCheck);
		expect(settings.profile_json).to.not.have.property('newer_version');
		expect(childProcess.spawn).to.have.property('callCount', 0);
	});

	it('just saves the last update time when the command is `update-cli`', async () => {
		const lastCheck = settings.profile_json.last_version_check;

		const result = await updateCheck(false, false, 'update-cli');

		expect(result).to.equal(undefined);
		expect(settings.saveProfileData).to.have.property('callCount', 1);
		expect(settings.profile_json.last_version_check).to.be.at.least(lastCheck);
		expect(settings.profile_json).to.not.have.property('newer_version');
		expect(childProcess.spawn).to.have.property('callCount', 0);
	});

	it('Does nothing when running from source', async () => {
		process.pkg = false;
		const result = await updateCheck();

		expect(result).to.equal(undefined);
		expect(settings.saveProfileData).to.have.property('callCount', 0);
		expect(childProcess.spawn).to.have.property('callCount', 0);
	});
});

