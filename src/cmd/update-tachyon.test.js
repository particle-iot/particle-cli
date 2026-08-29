'use strict';
const { expect } = require('../../test/setup');
const { planUpdate } = require('./update-tachyon');

function prog(label, group, sha) {
	return { label, lun: 0, slot: group === 'B' ? 'b' : 'a', group, ops: [{ op: 'program', source: `${label}.img`, payload_sha256: sha }] };
}

function manifest() {
	return {
		format: { slots_present: ['a', 'b'] },
		partitions: [
			prog('system_a', 'A', 'aaa'), prog('efi_a', 'A', 'eee'),
			prog('system_b', 'B', 'bbb'), prog('efi_b', 'B', 'fff'),
		],
	};
}

describe('planUpdate', () => {
	it('slot mode writes only the target slot group', () => {
		const plan = planUpdate(manifest(), { mode: 'slot', slot: 'b' });
		expect(plan.write.map((p) => p.label).sort()).to.deep.equal(['efi_b', 'system_b']);
	});

	it('factory mode writes everything', () => {
		const plan = planUpdate(manifest(), { mode: 'factory' });
		expect(plan.write).to.have.lengthOf(4);
	});

	it('skips no-op partitions (e.g. NV preserved by factory expand)', () => {
		const m = manifest();
		// after expand({kind:factory}), NVM partitions arrive with their ops stripped
		m.partitions.push({ label: 'modemst1', lun: 5, slot: 'none', group: 'NVM', ops: [] });
		const plan = planUpdate(m, { mode: 'factory' });
		expect(plan.write.map((p) => p.label)).to.not.include('modemst1');
		expect(plan.skipped.map((s) => s.label)).to.include('modemst1');
		expect(plan.skipped.find((s) => s.label === 'modemst1').reason).to.match(/preserved/);
	});

	it('treats a reserve-only partition as a skip (qdl does nothing for it)', () => {
		const m = manifest();
		m.partitions.push({ label: 'fsg', lun: 5, slot: 'none', group: 'NVM', ops: [{ op: 'reserve', start_sector: 2054, num_partition_sectors: 1024 }] });
		const plan = planUpdate(m, { mode: 'factory' });
		expect(plan.write.map((p) => p.label)).to.not.include('fsg');
		expect(plan.skipped.map((s) => s.label)).to.include('fsg');
	});

	it('erase view (slot-only, all erase ops) writes every partition', () => {
		// mimics lib.eraseSlotView output: slot-b partitions with erase ops
		const view = {
			format: { slots_present: ['b'] },
			partitions: [
				{ label: 'system_b', lun: 0, slot: 'b', group: 'B', ops: [{ op: 'erase', start_sector: 10, num_partition_sectors: 20 }] },
				{ label: 'xbl_b', lun: 1, slot: 'b', group: 'BOOT', ops: [{ op: 'erase', start_sector: 5, num_partition_sectors: 6 }] },
			],
		};
		const plan = planUpdate(view, { mode: 'erase', slot: 'b' });
		expect(plan.write.map((p) => p.label).sort()).to.deep.equal(['system_b', 'xbl_b']);
	});

	it('delta mode skips partitions whose device hash matches', () => {
		const plan = planUpdate(manifest(), {
			mode: 'delta',
			slot: 'b',
			deviceHashes: { system_b: 'bbb' }, // already up to date
		});
		expect(plan.write.map((p) => p.label)).to.deep.equal(['efi_b']);
		expect(plan.skipped.map((s) => s.label)).to.deep.equal(['system_b']);
	});

	it('delta mode writes when the device hash differs', () => {
		const plan = planUpdate(manifest(), {
			mode: 'delta',
			slot: 'b',
			deviceHashes: { system_b: 'OLD', efi_b: 'fff' },
		});
		expect(plan.write.map((p) => p.label)).to.deep.equal(['system_b']);
		expect(plan.skipped.map((s) => s.label)).to.deep.equal(['efi_b']);
	});
});
