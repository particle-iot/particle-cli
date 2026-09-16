'use strict';
const { expect } = require('../../../test/setup');
const { parsePrograms, validatePrograms } = require('./preserved-layout');

const row = (lun, label, start = 100) => ({
	physical_partition_number: String(lun), label, start_sector: String(start),
	num_partition_sectors: '4', SECTOR_SIZE_IN_BYTES: '4096', filename: `${label}.img`
});
const valid = () => [row(0, 'system'), row(0, 'efi', 200), row(6, 'dtb_a'), row(6, 'core_nhlos_a', 200)];
const table = () => valid().map(p => ({
	lun: Number(p.physical_partition_number),
	partition: { name: p.label, firstLBA: BigInt(p.start_sector), lastLBA: BigInt(p.start_sector) + 9n }
}));

describe('QLI GPT-preserving image validation', () => {
	it('accepts bounded writes within the live layout', () => {
		expect(() => validatePrograms(valid(), table())).not.to.throw();
	});
	it('accepts the empty last_parti entries in the head2 factory GPT', () => {
		const live = [...table(), ...[1, 2].flatMap(lun => [
			{ lun, partition: { name: 'xbl_config_b', firstLBA: 1936n, lastLBA: 2063n } },
			{ lun, partition: { name: 'last_parti', firstLBA: 2064n, lastLBA: 2063n } }
		])];
		expect(() => validatePrograms(valid(), live)).not.to.throw();
		expect(() => validatePrograms([...valid(), row(1, 'last_parti', 2064)], live)).to.throw('Forbidden');
	});
	it('still rejects reversed real partitions and nonempty overlapping terminators', () => {
		for (const partition of [
			{ name: 'persist', firstLBA: 2064n, lastLBA: 2063n },
			{ name: 'last_parti', firstLBA: 2064n, lastLBA: 2062n },
			{ name: 'last_parti', firstLBA: 102n, lastLBA: 150n }
		]) {
			expect(() => validatePrograms(valid(), [...table(), { lun: 0, partition }])).to.throw('live GPT');
		}
	});
	it('refuses a live layout whose payload overlaps protected storage', () => {
		const live = [...table(), { lun: 0, partition: { name: 'persist', firstLBA: 102n, lastLBA: 150n } }];
		expect(() => validatePrograms(valid(), live)).to.throw('overlapping live GPT');
	});

	it('rejects protected partition writes', () => {
		for (const label of ['misc', 'persist', 'PrimaryGPT', 'nvdata1']) {
			expect(() => validatePrograms([...valid(), row(0, label)], table())).to.throw('Forbidden');
		}
	});
	it('rejects a stale start sector and an oversized payload', () => {
		for (const change of [{ start_sector: '99' }, { num_partition_sectors: '11' }]) {
			const rows = valid();
			Object.assign(rows[0], change);
			expect(() => validatePrograms(rows, table())).to.throw('live partition');
		}
	});
	it('refuses ambiguous and incomplete payload sets', () => {
		expect(() => validatePrograms([...valid(), valid()[0]], table())).to.throw('duplicate');
		expect(() => validatePrograms(valid().slice(1), table())).to.throw('Missing required');
	});
	it('refuses expressions, sparse writes and file offsets', () => {
		for (const change of [{ start_sector: 'NUM_DISK_SECTORS-5.' }, { sparse: 'true' }, { file_sector_offset: '1' }]) {
			const rows = valid();
			Object.assign(rows[0], change);
			expect(() => validatePrograms(rows, table())).to.throw();
		}
	});
	it('rejects erase, patch, provisioning and unknown XML operations', () => {
		for (const operation of ['erase', 'patch', 'ufs', 'configure']) {
			expect(() => parsePrograms(`<data><${operation}/></data>`)).to.throw();
		}
	});
	it('parses only the finite composer program grammar', () => {
		const xml = '<?xml version="1.0"?><data><program label="system" start_sector="100" /></data>';
		expect(parsePrograms(xml)).to.eql([{ label: 'system', start_sector: '100' }]);
		expect(() => parsePrograms('<data><program label="system" label="persist" /></data>')).to.throw('Duplicate');
	});
});
