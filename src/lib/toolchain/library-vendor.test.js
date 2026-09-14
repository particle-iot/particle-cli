'use strict';
const path = require('path');
const fs = require('fs-extra');
const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../../test/setup');
const { PATH_TMP_DIR } = require('../../../test/lib/env');
const UI = require('../ui');

describe('Library vendoring before a local compile', () => {
	const projectDir = path.join(PATH_TMP_DIR, 'vendor-project');
	let runs, vendor, ui, api;

	// stands in for particle-commands' LibraryInstallCommand: records what the site asked for
	// and drops a library.properties where a real install would
	class FakeLibraryInstallCommand {
		async run(state, site) {
			const [name, version] = site.libraryName().split('@');
			runs.push({ name, version, vendored: site.isVendored(), adapters: site.isAdaptersRequired(), dir: site.targetDirectory() });
			await site.notifyFetchingLibrary({ name, version }, path.join(site.targetDirectory(), 'lib', name));
			await fs.outputFile(path.join(site.targetDirectory(), 'lib', name, 'library.properties'), `name=${name}\nversion=${version}\n`);
		}
	}

	beforeEach(async () => {
		runs = [];
		vendor = proxyquire('./library-vendor', { '../../cmd': { LibraryInstallCommand: FakeLibraryInstallCommand } });
		ui = new UI({ stdout: { write: sinon.stub() }, quiet: false });
		api = { getLibraryClient: sinon.stub().returns({ fake: 'client' }) };
		await fs.remove(projectDir);
		await fs.outputFile(path.join(projectDir, 'project.properties'),
			'name=app\ndependencies.neopixel=1.0.3\ndependencies.OneWire=2.0.4\nassetOtaDir=assets\n');
		await fs.outputFile(path.join(projectDir, 'lib', 'OneWire', 'library.properties'), 'name=OneWire\nversion=2.0.4\n');
	});

	afterEach(async () => {
		sinon.restore();
		await fs.remove(projectDir);
	});

	it('reads dependencies.* from project.properties', async () => {
		expect(await vendor.readDependencies(projectDir)).to.eql([
			{ name: 'neopixel', version: '1.0.3' },
			{ name: 'OneWire', version: '2.0.4' }
		]);
	});

	it('reads nothing when there is no project.properties', async () => {
		expect(await vendor.readDependencies(path.join(PATH_TMP_DIR, 'nope'))).to.eql([]);
	});

	it('treats lib/<name>/library.properties as vendored', async () => {
		expect(await vendor.missingDependencies(projectDir)).to.eql([{ name: 'neopixel', version: '1.0.3' }]);
	});

	it('vendors only the missing libraries, by name and version, into the project', async () => {
		const vendored = await vendor.vendorProjectLibraries({ projectDir, api, ui, accessToken: 'token' });
		expect(vendored).to.eql([{ name: 'neopixel', version: '1.0.3' }]);
		expect(runs).to.eql([{ name: 'neopixel', version: '1.0.3', vendored: true, adapters: false, dir: projectDir }]);
		expect(api.getLibraryClient).to.have.been.calledOnce;
		expect(await fs.pathExists(path.join(projectDir, 'lib', 'neopixel', 'library.properties'))).to.equal(true);
		expect(ui.stdout.write).to.have.been.calledWithMatch(/Installing library neopixel 1\.0\.3 to .*lib\/neopixel/);
	});

	it('does nothing, and needs no token, when everything is vendored', async () => {
		await fs.outputFile(path.join(projectDir, 'lib', 'neopixel', 'library.properties'), 'name=neopixel\n');
		const vendored = await vendor.vendorProjectLibraries({ projectDir, api, ui, accessToken: undefined });
		expect(vendored).to.eql([]);
		expect(api.getLibraryClient).to.not.have.been.called;
	});

	it('explains how to get the libraries when there is no token', async () => {
		await expect(vendor.vendorProjectLibraries({ projectDir, api, ui, accessToken: undefined })).to.be.rejectedWith(
			"The project depends on libraries that are not in lib/ yet (neopixel@1.0.3). Log in with 'particle login' or run 'particle library install --vendored' once, then retry"
		);
		expect(runs).to.eql([]);
	});

	it('stays silent under --quiet', async () => {
		ui = new UI({ stdout: { write: sinon.stub() }, quiet: true });
		await vendor.vendorProjectLibraries({ projectDir, api, ui, accessToken: 'token' });
		expect(ui.stdout.write).to.not.have.been.called;
	});
});
