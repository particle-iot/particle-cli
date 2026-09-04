'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { createHash } = require('crypto');
const proxyquire = require('proxyquire');
const { expect, sinon } = require('../../test/setup');

// The command destructures its helpers at require time, so the stubs have to be
// stable functions that forward to whatever the current test installed.
let getEDLDevice, prepareFlashFiles, handleFlashError;
const tachyonUtils = {
	addLogHeaders: (...args) => addLogHeaders(...args),
	addLogFooter: () => {},
	getEDLDevice: (...args) => getEDLDevice(...args),
	prepareFlashFiles: (...args) => prepareFlashFiles(...args),
	handleFlashError: (...args) => handleFlashError(...args)
};
let addLogHeaders;

let qdlRun;
class FakeQdlFlasher {
	run() {
		return qdlRun();
	}
}

let baseDir;
const settings = { ensureFolder: () => baseDir };

const BackupRestoreTachyonCommand = proxyquire('./backup-restore-tachyon', {
	'../lib/tachyon-utils': tachyonUtils,
	'../lib/qdl': FakeQdlFlasher,
	'../../settings': settings
});

function fakeUi() {
	return { stdout: { write: sinon.stub() }, chalk: { yellow: (s) => s } };
}

function partition(label, numSectors, filename) {
	return {
		label,
		physical_partition_number: 5,
		start_sector: 1088,
		num_partition_sectors: numSectors,
		filename
	};
}

describe('BackupRestoreTachyonCommand', () => {
	let command, ui, dir;

	beforeEach(async () => {
		baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tachyon-particle-'));
		dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tachyon-backup-'));
		ui = fakeUi();
		addLogHeaders = sinon.stub();
		getEDLDevice = sinon.stub().resolves({ id: 'e00fce68', serialNumber: '1' });
		prepareFlashFiles = sinon.stub().resolves({ firehosePath: 'fh.elf', xmlFile: 'x.xml' });
		handleFlashError = sinon.stub().resolves({ retry: false });
		qdlRun = sinon.stub().resolves();
		command = new BackupRestoreTachyonCommand({ ui });
	});

	afterEach(async () => {
		await Promise.all([fs.remove(dir), fs.remove(baseDir)]);
		sinon.restore();
	});

	describe('backup metadata', () => {
		it('records geometry, size and digest for every captured partition', async () => {
			const file = path.join(dir, 'e00fce68_modemst1.backup');
			await fs.writeFile(file, Buffer.alloc(4096, 7));
			const metadata = await command._writeBackupMetadata({
				dir, deviceId: 'e00fce68', partitions: [partition('modemst1', 1024, file)]
			});

			expect(metadata.schemaVersion).to.equal(1);
			expect(metadata.partitions[0]).to.include({
				label: 'modemst1', lun: 5, startSector: 1088, numSectors: 1024, bytes: 4096
			});
			expect(metadata.partitions[0].sha256)
				.to.equal(createHash('sha256').update(Buffer.alloc(4096, 7)).digest('hex'));
			expect(await fs.pathExists(path.join(dir, 'backup.json'))).to.equal(true);
		});

		it('restores an archive that predates the sidecar', async () => {
			expect(await command._readBackupMetadata({ dir, deviceId: 'e00fce68' })).to.equal(null);
			expect(ui.stdout.write).to.have.been.calledWithMatch(/predates backup.json/);
		});

		it('refuses a sidecar written by a newer CLI', async () => {
			await fs.writeJson(path.join(dir, 'backup.json'), { schemaVersion: 99, partitions: [] });
			await expect(command._readBackupMetadata({ dir, deviceId: 'e00fce68' }))
				.to.be.rejectedWith(/schema version 99/);
		});

		it('warns when the backup came from a different device', async () => {
			await fs.writeJson(path.join(dir, 'backup.json'), {
				schemaVersion: 1, deviceId: 'deadbeef', partitions: []
			});
			await command._readBackupMetadata({ dir, deviceId: 'e00fce68' });
			expect(ui.stdout.write).to.have.been.calledWithMatch(/taken from device deadbeef/);
		});
	});

	describe('_verifyBackupFiles', () => {
		let file, partitions;

		beforeEach(async () => {
			file = path.join(dir, 'e00fce68_modemst1.backup');
			await fs.writeFile(file, Buffer.alloc(4096, 7));
			partitions = [partition('modemst1', 1024, file)];
		});

		it('accepts a legacy archive with no recorded digests', async () => {
			await command._verifyBackupFiles({ partitions, metadata: null });
		});

		it('rejects a file that would overrun its target partition', async () => {
			// a 1.5MiB nvdata backup restored onto a device whose nvdata is 1MiB
			await fs.writeFile(file, Buffer.alloc(8192, 7));
			await expect(command._verifyBackupFiles({
				partitions: [partition('modemst1', 1, file)], metadata: null
			})).to.be.rejectedWith(/8192 bytes will not fit the 4096-byte partition/);
		});

		it('rejects a missing file before anything is written', async () => {
			await fs.remove(file);
			await expect(command._verifyBackupFiles({ partitions, metadata: null }))
				.to.be.rejectedWith(/is missing from the backup/);
		});

		it('rejects a file whose content no longer matches the sidecar', async () => {
			const metadata = await command._writeBackupMetadata({ dir, deviceId: 'e00fce68', partitions });
			await fs.writeFile(file, Buffer.alloc(4096, 9));
			await expect(command._verifyBackupFiles({ partitions, metadata }))
				.to.be.rejectedWith(/sha256 .* does not match the recorded/);
		});

		it('reports every problem at once rather than the first', async () => {
			const other = path.join(dir, 'e00fce68_fsc.backup');
			await fs.remove(file);
			await expect(command._verifyBackupFiles({
				partitions: [...partitions, partition('fsc', 1024, other)], metadata: null
			})).to.be.rejectedWith(/modemst1[\s\S]*fsc/);
		});
	});

	describe('_verifyRestoredPartitions', () => {
		let source, verifyDir, partitions;

		beforeEach(async () => {
			source = path.join(dir, 'e00fce68_modemst1.backup');
			await fs.writeFile(source, Buffer.alloc(4096, 7));
			partitions = [partition('modemst1', 1024, source)];
			// prepareFlashFiles is handed the directory the read-back lands in; the
			// fake qdl "reads" by writing that file itself.
			prepareFlashFiles = sinon.stub().callsFake(async ({ dir: readDir }) => {
				verifyDir = readDir;
				return { firehosePath: 'fh.elf', xmlFile: 'x.xml' };
			});
		});

		it('passes when the device reads back what was written', async () => {
			qdlRun = sinon.stub().callsFake(async () => {
				// the partition is larger than the backup: the tail is device state
				await fs.writeFile(
					path.join(verifyDir, 'e00fce68_modemst1.backup'),
					Buffer.concat([Buffer.alloc(4096, 7), Buffer.alloc(4096, 0)])
				);
			});
			await command._verifyRestoredPartitions({
				device: { id: 'e00fce68', serialNumber: '1' },
				outputLog: path.join(dir, 'log.txt'),
				partitions
			});
		});

		it('fails when the written bytes differ', async () => {
			qdlRun = sinon.stub().callsFake(async () => {
				await fs.writeFile(path.join(verifyDir, 'e00fce68_modemst1.backup'), Buffer.alloc(4096, 9));
			});
			await expect(command._verifyRestoredPartitions({
				device: { id: 'e00fce68', serialNumber: '1' },
				outputLog: path.join(dir, 'log.txt'),
				partitions
			})).to.be.rejectedWith(/written bytes do not match the backup/);
		});

		it('fails when a partition cannot be read back at all', async () => {
			qdlRun = sinon.stub().resolves();
			await expect(command._verifyRestoredPartitions({
				device: { id: 'e00fce68', serialNumber: '1' },
				outputLog: path.join(dir, 'log.txt'),
				partitions
			})).to.be.rejectedWith(/could not be read back/);
		});
	});

	describe('restore retry', () => {
		beforeEach(() => {
			command._getFilePathToRestore = sinon.stub().resolves(path.join(dir, 'backup.zip'));
			command.extractZipFile = sinon.stub().resolves(dir);
			command._verifyBackupFiles = sinon.stub().resolves();
			command._verifyRestoredPartitions = sinon.stub().resolves();
			command._readBackupMetadata = sinon.stub().resolves(null);
		});

		it('retries the restore, not a backup', async () => {
			// The catch used to call this.backup(), which does not even accept
			// input-dir: a failed restore quietly overwrote the archive instead.
			prepareFlashFiles = sinon.stub()
				.onFirstCall().rejects(new Error('device went away'))
				.onSecondCall().resolves({ firehosePath: 'fh.elf', xmlFile: 'x.xml' });
			handleFlashError = sinon.stub()
				.onFirstCall().resolves({ retry: true })
				.onSecondCall().resolves({ retry: false });

			await command.restore({ 'input-dir': dir, 'log-dir': dir });

			const commands = addLogHeaders.getCalls().map((c) => c.args[0].commandName);
			expect(commands).to.eql(['Tachyon restore', 'Tachyon restore']);
		});

		it('prints the command to run by hand when it gives up', async () => {
			prepareFlashFiles = sinon.stub().rejects(new Error('device went away'));
			await expect(command.restore({ 'input-dir': dir, 'log-dir': dir })).to.be.rejected;
			expect(ui.stdout.write).to.have.been.calledWithMatch(/particle tachyon restore --filepath/);
		});
	});
});
