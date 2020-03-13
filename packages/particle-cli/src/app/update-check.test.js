const semver = require('semver');
const { expect, sinon } = require('../../test/setup');
const updateCheck = require('./update-check');
const settings = require('../../settings');
const pkg = require('../../package');


describe('Update Check', () => {
	const sandbox = sinon.createSandbox();
	const internal = updateCheck.__internal__;
	const originalProfileJSON = settings.profile_json;
	let fakePkgVersion, fakeUpdateCheckTimeout, fakeUpdateCheckInterval,
		fakeLastVersionCheck;

	beforeEach(() => {
		fakeUpdateCheckTimeout = 1000;
		fakeUpdateCheckInterval = 0;
		fakeLastVersionCheck = 0;
		fakePkgVersion = '6.6.6';
		settings.profile_json = settings.profile_json || { last_version_check: undefined };
		sandbox.stub(settings, 'saveProfileData');
		sandbox.stub(settings, 'updateCheckInterval').get(() => fakeUpdateCheckInterval);
		sandbox.stub(settings, 'updateCheckTimeout').get(() => fakeUpdateCheckTimeout);
		sandbox.stub(settings.profile_json, 'last_version_check').get(() => fakeLastVersionCheck);
		sandbox.stub(settings.profile_json, 'last_version_check').set((x) => (fakeLastVersionCheck = x));
		sandbox.stub(pkg, 'version').get(() => fakePkgVersion);
		sandbox.stub(internal, 'displayVersionBanner');
		sandbox.stub(internal, 'latestVersion');
		sandbox.spy(semver, 'gt');
	});

	afterEach(() => {
		sandbox.restore();
		settings.profile_json = originalProfileJSON;
	});

	it('Checks for latest version', async () => {
		internal.latestVersion.resolves(fakePkgVersion);

		const lastCheck = settings.profile_json.last_version_check;
		const promise = updateCheck();

		expect(promise).to.have.property('then');

		const result = await promise;

		expect(result).to.equal(undefined);
		expect(semver.gt).to.have.property('callCount', 1);
		expect(semver.gt.firstCall.args).to.eql(['6.6.6', '6.6.6']);
		expect(internal.latestVersion).to.have.property('callCount', 1);
		expect(settings.saveProfileData).to.have.property('callCount', 1);
		expect(internal.displayVersionBanner).to.have.property('callCount', 0);
		expect(settings.profile_json.last_version_check).to.be.at.least(lastCheck);
		expect(settings.profile_json).to.not.have.property('newer_version');
	});

	it('Checks for latest version when forced', async () => {
		internal.latestVersion.resolves(fakePkgVersion);
		fakeLastVersionCheck = Date.now();
		fakeUpdateCheckInterval = 1000;

		const force = true;
		const lastCheck = settings.profile_json.last_version_check;
		const promise = updateCheck(undefined, force);

		expect(promise).to.have.property('then');

		const result = await promise;

		expect(result).to.equal(undefined);
		expect(semver.gt).to.have.property('callCount', 1);
		expect(semver.gt.firstCall.args).to.eql(['6.6.6', '6.6.6']);
		expect(internal.latestVersion).to.have.property('callCount', 1);
		expect(settings.saveProfileData).to.have.property('callCount', 1);
		expect(internal.displayVersionBanner).to.have.property('callCount', 0);
		expect(settings.profile_json.last_version_check).to.be.at.least(lastCheck);
		expect(settings.profile_json).to.not.have.property('newer_version');
	});

	it('Checks for latest version and handles timeout', async () => {
		fakeUpdateCheckTimeout = 100;
		internal.latestVersion.returns(new Promise(() => {}));
		const lastCheck = settings.profile_json.last_version_check;
		const promise = updateCheck();
		const result = await promise;

		expect(result).to.equal(undefined);
		expect(semver.gt).to.have.property('callCount', 1);
		expect(semver.gt.firstCall.args).to.eql(['6.6.6', '6.6.6']);
		expect(internal.latestVersion).to.have.property('callCount', 1);
		expect(settings.saveProfileData).to.have.property('callCount', 1);
		expect(internal.displayVersionBanner).to.have.property('callCount', 0);
		expect(settings.profile_json.last_version_check).to.be.at.least(lastCheck);
		expect(settings.profile_json).to.not.have.property('newer_version');
	});

	it('Checks for latest version and prompts to update', async () => {
		internal.latestVersion.resolves(semver.inc(fakePkgVersion, 'patch'));

		const lastCheck = settings.profile_json.last_version_check;
		const promise = updateCheck();

		expect(promise).to.have.property('then');

		const result = await promise;

		expect(result).to.equal(undefined);
		expect(semver.gt).to.have.property('callCount', 1);
		expect(semver.gt.firstCall.args).to.eql(['6.6.7', '6.6.6']);
		expect(internal.latestVersion).to.have.property('callCount', 1);
		expect(settings.saveProfileData).to.have.property('callCount', 1);
		expect(internal.displayVersionBanner).to.have.property('callCount', 1);
		expect(settings.profile_json.last_version_check).to.be.at.least(lastCheck);
		expect(settings.profile_json).to.have.property('newer_version', '6.6.7');
	});

	it('Does nothing when last check was completed within the allotted interval', async () => {
		fakeLastVersionCheck = Date.now();
		fakeUpdateCheckInterval = 1000;

		const promise = updateCheck();

		expect(promise).to.have.property('then');

		const result = await promise;

		expect(result).to.equal(undefined);
		expect(semver.gt).to.have.property('callCount', 0);
		expect(internal.latestVersion).to.have.property('callCount', 0);
		expect(settings.saveProfileData).to.have.property('callCount', 0);
	});

	it('Does nothing when `skip` flag is set', async () => {
		const skip = true;
		const promise = updateCheck(skip);

		expect(promise).to.have.property('then');

		const result = await promise;

		expect(result).to.equal(undefined);
		expect(semver.gt).to.have.property('callCount', 0);
		expect(internal.latestVersion).to.have.property('callCount', 0);
		expect(settings.saveProfileData).to.have.property('callCount', 0);
	});
});

