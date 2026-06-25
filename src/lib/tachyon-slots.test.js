'use strict';

const { expect } = require('../../test/setup');
const slots = require('./tachyon-slots');

describe('tachyon-slots (GPT A/B attribute bits)', () => {
	it('round-trips slot state through the attribute field', () => {
		const attr = slots.makeActivePending(0n, { priority: 3, retries: 7 });
		const s = slots.getSlotState(attr);
		expect(s).to.deep.equal({ priority: 3, active: true, retries: 7, success: false, unbootable: false });
	});

	it('makeActivePending sets active+priority+retries, clears success/unbootable', () => {
		const start = slots.markUnbootable(0n); // unbootable + active=0
		const attr = slots.makeActivePending(start);
		const s = slots.getSlotState(attr);
		expect(s.active).to.equal(true);
		expect(s.unbootable).to.equal(false);
		expect(s.success).to.equal(false);
		expect(s.priority).to.equal(slots.MAX_PRIORITY);
		expect(s.retries).to.equal(slots.MAX_RETRY);
	});

	it('makeInactiveFallback lowers priority and clears active but stays bootable', () => {
		const active = slots.makeActivePending(0n);
		const fallback = slots.makeInactiveFallback(active);
		const s = slots.getSlotState(fallback);
		expect(s.active).to.equal(false);
		expect(s.unbootable).to.equal(false);
		expect(s.priority).to.equal(slots.MAX_PRIORITY - 1);
	});

	it('markSuccessful commits the slot', () => {
		const attr = slots.markSuccessful(slots.makeActivePending(0n));
		expect(slots.getSlotState(attr).success).to.equal(true);
	});

	it('markUnbootable disables the slot', () => {
		const attr = slots.markUnbootable(slots.makeActivePending(0n));
		const s = slots.getSlotState(attr);
		expect(s.unbootable).to.equal(true);
		expect(s.active).to.equal(false);
		expect(s.priority).to.equal(0);
	});

	it('does not disturb unrelated low bits (e.g. GPT system/type flags)', () => {
		const base = 0b101n; // bits 0 and 2 set (system/required-style flags)
		const attr = slots.makeActivePending(base);
		expect(attr & 0b111n).to.equal(base);
	});

	describe('activeSlot resolution', () => {
		it('picks the slot with the active bit', () => {
			const a = slots.makeActivePending(0n);
			const b = slots.makeInactiveFallback(slots.makeActivePending(0n));
			expect(slots.activeSlot(a, b)).to.equal('a');
			expect(slots.activeSlot(b, a)).to.equal('b');
		});

		it('falls back to higher priority bootable slot when neither is active', () => {
			const hi = slots.makeInactiveFallback(slots.makeActivePending(0n), { priority: 3 });
			const lo = slots.makeInactiveFallback(slots.makeActivePending(0n), { priority: 1 });
			expect(slots.activeSlot(hi, lo)).to.equal('a');
			expect(slots.activeSlot(lo, hi)).to.equal('b');
		});

		it('avoids an unbootable slot', () => {
			const good = slots.makeActivePending(0n);
			const dead = slots.markUnbootable(slots.makeActivePending(0n));
			expect(slots.activeSlot(dead, good)).to.equal('b');
		});
	});
});
