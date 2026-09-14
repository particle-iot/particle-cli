'use strict';
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const nock = require('nock');
const { expect, sinon } = require('../../../test/setup');
const { PATH_TMP_DIR, PATH_FIXTURES_DIR } = require('../../../test/lib/env');
const UI = require('../ui');
const { ToolchainInstaller, RECEIPT_FILE, formatSize } = require('./installer');

const TARBALL = path.join(PATH_FIXTURES_DIR, 'toolchain', 'buildscripts-fake.tar.gz');
const HOST = 'https://binaries.particle.io';
const URL_PATH = '/buildscripts/buildscripts-v0.0.1.tar.gz';

describe('Toolchain installer', () => {
	const toolchainDir = path.join(PATH_TMP_DIR, 'toolchains-under-test');
	let tarball, sha256, dependency, ui, installer;

	before(async () => {
		tarball = await fs.readFile(TARBALL);
		sha256 = crypto.createHash('sha256').update(tarball).digest('hex');
	});

	beforeEach(async () => {
		await fs.remove(toolchainDir);
		dependency = { name: 'buildscripts', version: '0.0.1', main: '.', url: `${HOST}${URL_PATH}`, sha256 };
		ui = new UI({ stdout: { write: sinon.stub() }, quiet: true });
		installer = new ToolchainInstaller({ ui, toolchainDir });
	});

	afterEach(async () => {
		sinon.restore();
		nock.cleanAll();
		await fs.remove(toolchainDir);
	});

	function serveTarball() {
		return nock(HOST)
			.head(URL_PATH).reply(200, '', { 'content-length': `${tarball.length}` })
			.get(URL_PATH).reply(200, tarball, { 'content-length': `${tarball.length}` });
	}

	it('lays dependencies out like Workbench does', () => {
		expect(installer.rootFor(dependency)).to.equal(path.join(toolchainDir, 'buildscripts', '0.0.1'));
		expect(installer.dirFor({ ...dependency, main: './bin' })).to.equal(path.join(toolchainDir, 'buildscripts', '0.0.1', 'bin'));
		expect(installer.receiptFor(dependency)).to.equal(path.join(toolchainDir, 'buildscripts', '0.0.1', RECEIPT_FILE));
	});

	it('is not installed when only the directory exists', async () => {
		await fs.ensureDir(installer.rootFor(dependency));
		expect(await installer.isInstalled(dependency)).to.equal(false);
	});

	it('is installed when the receipt matches', async () => {
		await fs.outputJson(installer.receiptFor(dependency), { name: 'buildscripts', version: '0.0.1', installed: 1 });
		expect(await installer.isInstalled(dependency)).to.equal(true);
	});

	it('downloads, verifies, unpacks and writes the receipt', async () => {
		const scope = serveTarball();
		const result = await installer.ensureInstalled([dependency]);
		expect(result.installed).to.eql([dependency]);
		expect(result.skipped).to.eql([]);
		expect(await fs.readFile(path.join(installer.dirFor(dependency), 'Makefile'), 'utf8')).to.include('compile-user');
		const receipt = await fs.readJson(installer.receiptFor(dependency));
		expect(receipt).to.include({ name: 'buildscripts', version: '0.0.1' });
		expect(receipt.installed).to.be.a('number');
		expect(scope.isDone()).to.equal(true);
	});

	it('never downloads what is already installed', async () => {
		await fs.outputJson(installer.receiptFor(dependency), { name: 'buildscripts', version: '0.0.1', installed: 1 });
		// no nock interceptor: any request would throw
		nock.disableNetConnect();
		try {
			const result = await installer.ensureInstalled([dependency]);
			expect(result.installed).to.eql([]);
			expect(result.skipped).to.eql([dependency]);
			expect(ui.stdout.write).to.not.have.been.called;
		} finally {
			nock.enableNetConnect();
		}
	});

	it('announces what it downloads with sizes, then what it installed', async () => {
		ui = new UI({ stdout: { write: sinon.stub() }, quiet: false });
		sinon.stub(ui, 'createProgressBar').returns({ start: sinon.stub(), increment: sinon.stub(), stop: sinon.stub() });
		installer = new ToolchainInstaller({ ui, toolchainDir });
		serveTarball();
		await installer.ensureInstalled([dependency], { label: 'Local toolchain for Device OS 6.4.1 (argon)' });
		const lines = ui.stdout.write.args.map(([line]) => line.trim());
		expect(lines[0]).to.equal(`Local toolchain for Device OS 6.4.1 (argon): downloading buildscripts 0.0.1 (1 KB) to ${toolchainDir}`);
		expect(lines).to.include('Installed buildscripts 0.0.1');
	});

	it('fails naming the dependency when the download fails, leaving no receipt', async () => {
		nock(HOST).head(URL_PATH).reply(404).get(URL_PATH).times(2).reply(404);
		await expect(installer.ensureInstalled([dependency])).to.be.rejectedWith(
			`Could not download buildscripts 0.0.1 for the local toolchain: HTTP 404 from ${HOST}${URL_PATH}. Check your connection and retry`
		);
		expect(await fs.pathExists(installer.rootFor(dependency))).to.equal(false);
	});

	it('retries once on a checksum mismatch, then fails without a receipt', async () => {
		dependency.sha256 = 'deadbeef';
		const scope = nock(HOST)
			.head(URL_PATH).reply(200, '', { 'content-length': `${tarball.length}` })
			.get(URL_PATH).times(2).reply(200, tarball);
		await expect(installer.ensureInstalled([dependency])).to.be.rejectedWith(
			/Could not download buildscripts 0\.0\.1 for the local toolchain: checksum mismatch, expected deadbeef got [0-9a-f]{64}\. Check your connection and retry/
		);
		expect(scope.isDone()).to.equal(true);
		expect(await fs.pathExists(installer.receiptFor(dependency))).to.equal(false);
	});

	it('removes a partial install when unpacking fails', async () => {
		const garbage = Buffer.from('not a tarball');
		dependency.sha256 = crypto.createHash('sha256').update(garbage).digest('hex');
		nock(HOST).head(URL_PATH).reply(200, '', { 'content-length': '13' }).get(URL_PATH).reply(200, garbage);
		await expect(installer.ensureInstalled([dependency])).to.be.rejectedWith(/Could not download buildscripts 0\.0\.1/);
		expect(await fs.pathExists(installer.rootFor(dependency))).to.equal(false);
	});

	it('formats sizes for the download notice', () => {
		expect(formatSize(183)).to.equal('1 KB');
		expect(formatSize(425 * 1024 * 1024)).to.equal('425 MB');
		expect(formatSize(1.8 * 1024 * 1024 * 1024)).to.equal('1.8 GB');
	});
});
