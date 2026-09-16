'use strict';
const { expect, sinon } = require('../../test/setup');
const DownloadTachyonPackageCommand = require('./download-tachyon-package');
const DownloadManager = require('../lib/download-manager');
const { workflows } = require('../lib/tachyon/workflow');

const builds = Object.values(workflows).flatMap(workflow => workflow.variants.map(variant => ({
	distribution: workflow.osInfo.distribution,
	distribution_version: workflow.osInfo.distributionVersion,
	region: 'NA', board: 'formfactor_dvt', variant: variant.value,
	artifacts: [{ artifact_url: `https://example.com/${workflow.value}-${variant.value}.zip`, sha256_checksum: 'checksum' }]
})));

describe('DownloadTachyonPackageCommand OS selection', () => {
	let command;
	let ui;
	let fetchManifest;
	let download;

	beforeEach(() => {
		ui = {
			write: sinon.stub(),
			chalk: { bold: { white: value => value } },
			prompt: sinon.stub().callsFake(async ([question]) => ({
				[question.name]: question.default || (question.name === 'osType' ? 'qli20' : 'headless')
			}))
		};
		fetchManifest = sinon.stub(DownloadManager.prototype, 'fetchManifest').callsFake(async ({ version }) => ({
			builds: builds.filter(build => version !== 'stable' || ['20.04', '24.04'].includes(build.distribution_version))
		}));
		download = sinon.stub(DownloadManager.prototype, 'download').resolves('/tmp/image.zip');
		command = new DownloadTachyonPackageCommand({ ui });
	});

	afterEach(() => sinon.restore());

	for (const [distro, workflow, channel] of [
		['20.04', 'ubuntu20', 'stable'], ['24.04', 'ubuntu24', 'stable'],
		['26.04', 'ubuntu26', 'latest'], ['qli-2.0', 'qli20', 'latest']
	]) {
		it(`downloads ${distro} using the default ${channel} channel and correct OS artifact`, async () => {
			await command.download({ distro_version: distro, region: 'NA' });
			const versionPrompt = ui.prompt.getCalls().find(call => call.args[0][0].name === 'version');
			expect(versionPrompt.args[0][0].default).to.equal(channel);
			expect(download).to.have.been.calledWithMatch({
				url: `https://example.com/${workflow}-headless.zip`, expectedChecksum: 'checksum'
			});
		});
	}

	it('offers all four Linux OSes when no distro was specified and automatically selects QLI headless', async () => {
		await command.download({ region: 'NA' });
		const choices = ui.prompt.firstCall.args[0][0].choices;
		expect(choices.map(choice => choice.value)).to.include.members(['ubuntu20', 'ubuntu24', 'ubuntu26', 'qli20']);
		expect(choices.find(choice => choice.value === 'qli20').name).to.include('(Beta)');
		expect(ui.prompt.getCalls().some(call => call.args[0][0].name === 'variant')).to.equal(false);
		expect(download).to.have.been.calledWithMatch({ url: 'https://example.com/qli20-headless.zip' });
	});

	it('honors an explicit version without requesting channel metadata', async () => {
		await command.download({ distro_version: 'qli-2.0', version: '1.4.2', region: 'NA' });
		expect(fetchManifest).to.have.been.calledOnce;
		expect(fetchManifest).to.have.been.calledWith({ version: '1.4.2' });
		expect(ui.prompt).not.to.have.been.called;
	});

	it('rejects the bare 2.0 distro identifier before downloading', async () => {
		await expect(command.download({ distro_version: '2.0', version: 'latest', region: 'NA' }))
			.to.be.rejectedWith("Unsupported Linux distribution version '2.0'");
		expect(download).not.to.have.been.called;
	});

	it('rejects QLI desktop before downloading', async () => {
		await expect(command.download({
			distro_version: 'qli-2.0', version: 'latest', variant: 'desktop', region: 'NA'
		})).to.be.rejectedWith('No build available');
		expect(download).not.to.have.been.called;
	});

	it('preserves RB3 server selection without showing the Tachyon OS menu', async () => {
		fetchManifest.resolves({ builds: [{
			region: '', board: 'rb3g2', variant: 'preinstalled-server',
			artifacts: [{ artifact_url: 'https://example.com/rb3.zip' }]
		}] });
		await command.download({ board: 'rb3g2', version: 'latest' });
		expect(ui.prompt).not.to.have.been.called;
		expect(download).to.have.been.calledWithMatch({ url: 'https://example.com/rb3.zip' });
	});
});
