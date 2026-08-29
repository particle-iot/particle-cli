'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { expect } = require('../../test/setup');
const { parseRawProgramPartitions, readPartitionsFromImage } = require('./tachyon-utils');

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
});
