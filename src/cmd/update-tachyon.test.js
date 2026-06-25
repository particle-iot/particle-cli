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

	it('full mode writes everything', () => {
		const plan = planUpdate(manifest(), { mode: 'full' });
		expect(plan.write).to.have.lengthOf(4);
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
