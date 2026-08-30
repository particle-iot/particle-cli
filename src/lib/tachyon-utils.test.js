'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { expect } = require('../../test/setup');
const GPT = require('gpt');
const { parseRawProgramPartitions, readPartitionsFromImage, readLunCapacities, partitionDefinitions, getIdentification } = require('./tachyon-utils');

const rawprogram0 = `<?xml version="1.0" ?>
<data>
  <erase start_sector="100" physical_partition_number="0" num_partition_sectors="50" SECTOR_SIZE_IN_BYTES="4096" label="system_a"/>
  <program start_sector="100" physical_partition_number="0" num_partition_sectors="2" filename="system_a.img" SECTOR_SIZE_IN_BYTES="4096" label="system_a"/>
  <program start_sector="160" physical_partition_number="0" num_partition_sectors="256" filename="" SECTOR_SIZE_IN_BYTES="4096" label="misc"/>
  <program start_sector="NUM_DISK_SECTORS-5." physical_partition_number="0" num_partition_sectors="5" filename="gpt_backup0.bin" SECTOR_SIZE_IN_BYTES="4096" label="BackupGPT"/>
</data>
`;

describe('tachyon-utils partition tables', () => {
	describe('parseRawProgramPartitions', () => {
		it('takes the union of the erase extent and the program chunks', () => {
			const table = parseRawProgramPartitions([rawprogram0]);
			expect(table.get('system_a')).to.eql({ lun: 0, startSector: 100, numSectors: 50 });
		});

		it('reads a reserve-only partition that has no payload', () => {
			const table = parseRawProgramPartitions([rawprogram0]);
			expect(table.get('misc')).to.eql({ lun: 0, startSector: 160, numSectors: 256 });
		});

		it('skips entries whose sectors are ptool expressions', () => {
			// NUM_DISK_SECTORS-5. only resolves against a real device.
			expect(parseRawProgramPartitions([rawprogram0]).has('BackupGPT')).to.equal(false);
		});

		it('merges entries spread across several rawprogram files', () => {
			const other = '<data><program start_sector="8" physical_partition_number="5" num_partition_sectors="16" label="fsc"/></data>';
			const table = parseRawProgramPartitions([rawprogram0, other]);
			expect(table.get('fsc')).to.eql({ lun: 5, startSector: 8, numSectors: 16 });
			expect(table.size).to.equal(3);
		});
	});

	describe('readPartitionsFromImage', () => {
		let dir;

		beforeEach(async () => {
			dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tachyon-image-'));
			await fs.writeJson(path.join(dir, 'manifest.json'), {
				targets: [{ qcm6490: { edl: {
					base: '.',
					firehose: 'prog_firehose_ddr.elf',
					program_xml: ['rawprogram0.xml'],
					patch_xml: ['patch0.xml']
				} } }]
			});
			await fs.writeFile(path.join(dir, 'rawprogram0.xml'), rawprogram0);
		});

		afterEach(async () => {
			await fs.remove(dir);
		});

		it('reads the table an unpacked image declares', async () => {
			const table = await readPartitionsFromImage({ imagePath: dir });
			expect(table.get('misc')).to.eql({ lun: 0, startSector: 160, numSectors: 256 });
		});

		it('throws when a referenced rawprogram file is missing', async () => {
			await fs.remove(path.join(dir, 'rawprogram0.xml'));
			await expect(readPartitionsFromImage({ imagePath: dir })).to.be.rejected;
		});
	});

	describe('partitionDefinitions', () => {
		const table = [
			{ lun: 0, partition: { name: 'system', firstLBA: 100n, lastLBA: 199n } },
			{ lun: 5, partition: { name: 'fsg', firstLBA: 64n, lastLBA: 1087n } }
		];

		it('throws when a required partition is missing', () => {
			expect(() => partitionDefinitions({
				partitionList: ['fsg', 'boot_a'],
				partitionTable: table,
				deviceId: 'abc',
				dir: '/tmp'
			})).to.throw('Partition boot_a not found in device partition table');
		});

		it('skips a missing partition that is declared optional', () => {
			const parts = partitionDefinitions({
				partitionList: ['fsg', 'boot_a', 'boot_b'],
				partitionTable: table,
				deviceId: 'abc',
				dir: '/tmp',
				optionalPartitions: ['boot_a', 'boot_b']
			});
			expect(parts).to.have.lengthOf(1);
			expect(parts[0].label).to.equal('fsg');
		});

		it('still returns an optional partition when it is present', () => {
			const parts = partitionDefinitions({
				partitionList: ['system'],
				partitionTable: table,
				deviceId: 'abc',
				dir: '/tmp',
				optionalPartitions: ['system']
			});
			expect(parts).to.have.lengthOf(1);
			expect(parts[0].num_partition_sectors).to.equal(100);
		});
	});

	describe('getIdentification', () => {
		let dir;
		const writeFsg = async () => {
			const fsg = path.join(dir, 'fsg.bin');
			await fs.writeFile(fsg, Buffer.alloc(64));
			return fsg;
		};

		beforeEach(async () => {
			dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ident-'));
		});
		afterEach(async () => {
			await fs.remove(dir);
		});

		it('identifies the 24.04 layout when boot_a/boot_b are absent', async () => {
			const partitionTable = [
				{ lun: 5, partition: { name: 'nvdata1' } },
				{ lun: 0, partition: { name: 'system' } },
				{ lun: 0, partition: { name: 'misc' } }
			];
			const info = await getIdentification({
				deviceId: 'abc',
				partitionTable,
				partitionFilenames: { fsg: await writeFsg() }
			});
			expect(info.osVersion).to.equal('Ubuntu 24.04');
			expect(info.deviceId).to.equal('abc');
		});

		it('does not claim 24.04 for a slotted system layout with no boot partitions', async () => {
			const partitionTable = [
				{ lun: 5, partition: { name: 'nvdata1' } },
				{ lun: 0, partition: { name: 'system_a' } },
				{ lun: 0, partition: { name: 'system' } }
			];
			const info = await getIdentification({
				deviceId: 'abc',
				partitionTable,
				partitionFilenames: { fsg: await writeFsg() }
			});
			expect(info.osVersion).to.equal('Unknown');
		});
	});

	describe('readLunCapacities', () => {
		let dir;

		/** A primary GPT whose backup header sits at `lastSector`. */
		async function writeGpt(lun, lastSector) {
			const gpt = new GPT({ blockSize: 4096 });
			gpt.currentLBA = 1n;
			gpt.backupLBA = BigInt(lastSector);
			gpt.firstLBA = 6n;
			gpt.lastLBA = BigInt(lastSector - 5);
			gpt.tableOffset = 2n;
			const buffer = Buffer.alloc(gpt.blockSize * 6);
			gpt.write(buffer, gpt.blockSize);
			await fs.writeFile(path.join(dir, `gpt_main${lun}.bin`), buffer);
		}

		beforeEach(async () => {
			dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tachyon-gpt-'));
		});

		afterEach(async () => {
			await fs.remove(dir);
		});

		it('reports each LUN size from the GPT the device is running', async () => {
			// The firehose resolves NUM_DISK_SECTORS against the real LUN, so this is
			// the authoritative size -- the provisioning XML only records a request.
			await writeGpt(1, 2068);
			await writeGpt(5, 36863);
			expect(await readLunCapacities({ gptPath: dir })).to.eql([
				{ lun: 1, sectors: 2069 },
				{ lun: 5, sectors: 36864 }
			]);
		});

		it('skips a LUN that has no GPT, as on an EVT device without LUN 6', async () => {
			expect(await readLunCapacities({ gptPath: dir })).to.eql([]);
		});
	});
});
