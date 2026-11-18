'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../../test/setup');

// steps.js destructures these at require time, so the stub object has to expose
// stable functions that forward to whatever the current test installed.
let prepareFlashFiles;
let readPartitionsFromImage;
const tachyonUtils = {
	promptWifiNetworks: () => {},
	prepareFlashFiles: (...args) => prepareFlashFiles(...args),
	readPartitionsFromImage: (...args) => readPartitionsFromImage(...args),
	CONFIG_PARTITION: 'misc',
	CONFIG_PARTITION_SECTORS: 256,
	SECTOR_SIZE_IN_BYTES: 4096
};

let flashTachyon;
let flashTachyonXml;
class FakeFlashCommand {
	flashTachyon(...args) {
		return flashTachyon(...args);
	}
	flashTachyonXml(...args) {
		return flashTachyonXml(...args);
	}
}

const steps = proxyquire('./steps', {
	'../tachyon-utils': tachyonUtils,
	'../../cmd/flash': FakeFlashCommand
});

function fakeUi() {
	return { write: sinon.stub(), chalk: { yellow: (s) => s, bold: (s) => s } };
}

function miscTable(numSectors) {
	return new Map([['misc', { lun: 0, startSector: 160, numSectors }]]);
}

describe('tachyon setup steps', () => {
	let ui, dir, configBlobPath, workflow;

	beforeEach(async () => {
		ui = fakeUi();
		dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tachyon-steps-'));
		configBlobPath = path.join(dir, 'e00fce68_misc.backup');
		await fs.writeFile(configBlobPath, Buffer.alloc(2048));
		workflow = { osInfo: { distributionDisplay: 'Ubuntu 24.04' } };
		flashTachyon = sinon.stub().resolves();
		flashTachyonXml = sinon.stub().resolves();
		prepareFlashFiles = sinon.stub().resolves({ xmlFile: path.join(dir, 'partitions_program.xml') });
		readPartitionsFromImage = sinon.stub().resolves(miscTable(256));
	});

	afterEach(async () => {
		await fs.remove(dir);
		sinon.restore();
	});

	describe('verifyConfigPartitionStep', () => {
		const run = (over = {}) => steps.verifyConfigPartitionStep(
			{ ui, osFilePath: '/tmp/tachyon-ubuntu-24.04-NA-headless-1.2.0.zip', configBlobPath, workflow, ...over },
			2
		);

		it('accepts an image that declares a 1MiB misc partition', async () => {
			await run();
			expect(readPartitionsFromImage).to.have.property('callCount', 1);
		});

		it('fails when the image has no misc partition at all', async () => {
			readPartitionsFromImage.resolves(new Map());
			await expect(run()).to.be.rejectedWith(/has no 'misc' partition/);
		});

		it('fails when the image declares an undersized misc partition', async () => {
			readPartitionsFromImage.resolves(miscTable(64));
			await expect(run()).to.be.rejectedWith(/is 64 sectors; at least 256 are required/);
		});

		it('fails when the configuration is larger than the partition', async () => {
			await fs.writeFile(configBlobPath, Buffer.alloc(2 * 1024 * 1024));
			await expect(run()).to.be.rejectedWith(/holds 1048576/);
		});

		it('does not inspect the image when the OS is not being flashed', async () => {
			await run({ skipFlashingOs: true });
			expect(readPartitionsFromImage).to.have.property('callCount', 0);
		});
	});

	describe('flashOSAndConfigStep', () => {
		const context = () => ({
			ui,
			log: { file: path.join(dir, 'flash.log'), info: sinon.stub() },
			device: { id: 'e00fce68', serialNumber: '1', usbVersion: { major: 3 } },
			configBlobPath,
			variant: 'headless',
			osFilePath: '/tmp/os.zip',
			workflow
		});

		it('resolves misc from the GPT only after the OS has been written', async function () {
			this.timeout(10000);
			await steps.flashOSAndConfigStep(context(), 3);

			expect(flashTachyon).to.have.property('callCount', 1);
			expect(prepareFlashFiles).to.have.property('callCount', 1);
			// The whole point: the partition table is read from the device the image
			// just installed, not from the one it replaced.
			expect(flashTachyon.calledBefore(prepareFlashFiles)).to.equal(true);
			expect(prepareFlashFiles.calledBefore(flashTachyonXml)).to.equal(true);
			expect(prepareFlashFiles.firstCall.args[0].partitionsList).to.eql(['misc']);
		});

		it('keeps the device in EDL across the OS write so the blob can follow', async function () {
			this.timeout(10000);
			await steps.flashOSAndConfigStep(context(), 3);
			expect(flashTachyon.firstCall.args[0].skipReset).to.equal(true);
		});

		it('explains which image is at fault when misc is absent after flashing', async function () {
			this.timeout(10000);
			prepareFlashFiles.rejects(new Error('Partition misc not found in device partition table'));
			await expect(steps.flashOSAndConfigStep(context(), 3))
				.to.be.rejectedWith(/no 'misc' partition after flashing 'os\.zip'/);
		});

		it('skips the configuration write entirely when there is no blob', async function () {
			this.timeout(10000);
			await steps.flashOSAndConfigStep({ ...context(), configBlobPath: undefined }, 3);
			expect(prepareFlashFiles).to.have.property('callCount', 0);
			expect(flashTachyonXml).to.have.property('callCount', 0);
		});
	});
});

// The Tachyon system password is hashed with sha512crypt-node into the
// /etc/shadow format. Pin the library to the reference vectors from the
// SHA-crypt specification so dependency changes can't silently alter hashes.
describe('tachyon system password hash (sha512crypt)', () => {
	const { sha512crypt } = require('sha512crypt-node');

	it('matches the SHA-crypt reference vector', () => {
		expect(sha512crypt('Hello world!', '$6$saltstring'))
			.to.equal('$6$saltstring$svn8UoSVapNtMuq1ukKS4tPQd8iKwSMHWjl/O817G3uBnIFNjnQJuesI68u4OTLiBFdcbYEdFCoEOfaS35inz1');
	});

	it('matches the SHA-crypt reference vector with custom rounds', () => {
		expect(sha512crypt('Hello world!', '$6$rounds=10000$saltstringsaltstring'))
			.to.equal('$6$rounds=10000$saltstringsaltst$OW1/O6BYHV6BcXZu8QVeXbDWra3Oeqh0sbHbbMCVNSnCM/UrjmM0Dp8vOuZeHBy/YTBmSK6H9qs/y3RnOaw5v.');
	});

	describe('_generateShadowCompatibleHash', () => {
		const crypto = require('crypto');
		// base64 of these bytes is `++++ABEiM/v/RFVm`, which exercises the
		// `+` -> `.` salt translation and keeps a `/`
		const FIXED_SALT_BYTES = Buffer.from('fbefbe00112233fbff445566', 'hex');

		afterEach(() => {
			sinon.restore();
		});

		it('hashes the password with a 12 byte random salt in crypt base64', () => {
			sinon.stub(crypto, 'randomBytes').returns(FIXED_SALT_BYTES);

			expect(steps._generateShadowCompatibleHash('particle-tachyon'))
				.to.equal('$6$....ABEiM/v/RFVm$K70swnOEFWdqlFN1OltdcepzI9NDv61uLzEefEalsgap2mFmBDqrlGaxit8aU7C2g1PA/jc.AfuxOzcxwW9Eg.');
			expect(crypto.randomBytes).to.have.been.calledOnceWith(12);
		});

		it('hashes passwords with spaces, symbols and non-ascii characters', () => {
			sinon.stub(crypto, 'randomBytes').returns(FIXED_SALT_BYTES);

			expect(steps._generateShadowCompatibleHash('p@ss wörd!'))
				.to.equal('$6$....ABEiM/v/RFVm$Mwhx6gZYo7NT5AwHjaZQdKRF5L5SPeFbmxYsORIkNeF7tlAQKW2LAQ/IKU3qBVgeE33yDnc0nveP2UUfUa1Ne0');
		});

		it('uses a different salt on each call', () => {
			const first = steps._generateShadowCompatibleHash('particle-tachyon');
			const second = steps._generateShadowCompatibleHash('particle-tachyon');

			expect(first).to.match(/^\$6\$[A-Za-z0-9./]{16}\$[A-Za-z0-9./]{86}$/);
			expect(second).to.match(/^\$6\$[A-Za-z0-9./]{16}\$[A-Za-z0-9./]{86}$/);
			expect(first).to.not.equal(second);
		});
	});
});
