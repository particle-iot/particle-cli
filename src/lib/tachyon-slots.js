'use strict';

/**
 * Qualcomm UEFI A/B slot selection via GPT partition-entry attribute bits.
 *
 * The active slot is chosen by the bootloader from these 64-bit attribute-field
 * bits on the A/B partitions (persistent in the GPT, not UEFI variables):
 *
 *   bits 48-49  PRIORITY      (0 = unbootable-by-priority, higher = preferred)
 *   bit  50     ACTIVE        (the slot the loader currently selects)
 *   bits 51-53  RETRY/tries   (decremented each boot attempt; 0 + !success => give up)
 *   bit  54     SUCCESS        (slot booted successfully; commit)
 *   bit  55     UNBOOTABLE     (slot must not be selected)
 *
 * NOTE: confirm these exact positions against the BP source
 * (QcomPkg/.../PartitionTableUpdate.h) before trusting on hardware — wrong bits
 * brick slot selection. These match the standard Qualcomm boot_control layout.
 *
 * All helpers are pure functions over a BigInt `attr` so they unit-test without
 * a device; the command layer parses/serializes the GPT (the `gpt` npm package)
 * and applies them.
 */

const PRIORITY_SHIFT = 48n;
const PRIORITY_MASK = 0x3n; // 2 bits
const ACTIVE_BIT = 50n;
const RETRY_SHIFT = 51n;
const RETRY_MASK = 0x7n; // 3 bits
const SUCCESS_BIT = 54n;
const UNBOOTABLE_BIT = 55n;

const MAX_PRIORITY = 3;
const MAX_RETRY = 7;

function bit(attr, n) {
	return (attr >> n) & 1n;
}
function setBit(attr, n, v) {
	return v ? attr | (1n << n) : attr & ~(1n << n);
}
function getField(attr, shift, mask) {
	return Number((attr >> shift) & mask);
}
function setField(attr, shift, mask, value) {
	const v = BigInt(value) & mask;
	return (attr & ~(mask << shift)) | (v << shift);
}

/** Decode the slot state from a partition-entry attribute BigInt. */
function getSlotState(attr) {
	attr = BigInt(attr);
	return {
		priority: getField(attr, PRIORITY_SHIFT, PRIORITY_MASK),
		active: bit(attr, ACTIVE_BIT) === 1n,
		retries: getField(attr, RETRY_SHIFT, RETRY_MASK),
		success: bit(attr, SUCCESS_BIT) === 1n,
		unbootable: bit(attr, UNBOOTABLE_BIT) === 1n,
	};
}

/**
 * Mark a slot as the freshly-updated boot target: active, max priority, full
 * retries, NOT yet successful (pending — proven on the next good boot), bootable.
 */
function makeActivePending(attr, { priority = MAX_PRIORITY, retries = MAX_RETRY } = {}) {
	attr = BigInt(attr);
	attr = setField(attr, PRIORITY_SHIFT, PRIORITY_MASK, priority);
	attr = setField(attr, RETRY_SHIFT, RETRY_MASK, retries);
	attr = setBit(attr, ACTIVE_BIT, true);
	attr = setBit(attr, SUCCESS_BIT, false);
	attr = setBit(attr, UNBOOTABLE_BIT, false);
	return attr;
}

/** Demote the other slot to a still-bootable fallback (lower priority, inactive). */
function makeInactiveFallback(attr, { priority = MAX_PRIORITY - 1 } = {}) {
	attr = BigInt(attr);
	attr = setField(attr, PRIORITY_SHIFT, PRIORITY_MASK, priority);
	attr = setBit(attr, ACTIVE_BIT, false);
	return attr;
}

/** Commit the current slot after a healthy boot. */
function markSuccessful(attr, { retries = MAX_RETRY } = {}) {
	attr = BigInt(attr);
	attr = setBit(attr, SUCCESS_BIT, true);
	attr = setBit(attr, UNBOOTABLE_BIT, false);
	attr = setField(attr, RETRY_SHIFT, RETRY_MASK, retries);
	return attr;
}

/** Mark a slot unbootable (rollback / failed update). */
function markUnbootable(attr) {
	attr = BigInt(attr);
	attr = setBit(attr, UNBOOTABLE_BIT, true);
	attr = setBit(attr, ACTIVE_BIT, false);
	attr = setField(attr, PRIORITY_SHIFT, PRIORITY_MASK, 0);
	return attr;
}

/** Slot 'a'|'b' considered active given both slots' attributes. */
function activeSlot(attrA, attrB) {
	const a = getSlotState(attrA);
	const b = getSlotState(attrB);
	// active bit wins; else higher priority bootable slot
	if (a.active && !b.active) {
		return 'a';
	}
	if (b.active && !a.active) {
		return 'b';
	}
	const aBootable = !a.unbootable && a.priority > 0;
	const bBootable = !b.unbootable && b.priority > 0;
	if (aBootable && (!bBootable || a.priority >= b.priority)) {
		return 'a';
	}
	if (bBootable) {
		return 'b';
	}
	return 'a';
}

/**
 * Plan an A/B slot switch over the slot-bearing partitions.
 * @param {{label:string, lun:number, slot:'a'|'b', attr:bigint}[]} slotParts
 * @param {'a'|'b'} target
 * @returns {{current:'a'|'b', target:'a'|'b', changes:Array<{label:string,lun:number,slot:string,fromAttr:bigint,toAttr:bigint}>}}
 */
function planSlotSwitch(slotParts, target) {
	if (target !== 'a' && target !== 'b') {
		throw new Error(`slot target must be 'a' or 'b' (got '${target}')`);
	}
	const sys = slotParts.filter((p) => /^system_[ab]$/.test(p.label));
	const ref = sys.length ? sys : slotParts;
	const a = ref.find((p) => p.slot === 'a');
	const b = ref.find((p) => p.slot === 'b');
	const current = activeSlot(a ? a.attr : 0n, b ? b.attr : 0n);

	const changes = [];
	for (const p of slotParts) {
		const fromAttr = BigInt(p.attr);
		const toAttr = p.slot === target ? makeActivePending(fromAttr) : makeInactiveFallback(fromAttr);
		if (toAttr !== fromAttr) {
			changes.push({ label: p.label, lun: p.lun, slot: p.slot, fromAttr, toAttr });
		}
	}
	return { current, target, changes };
}

module.exports = {
	PRIORITY_SHIFT, PRIORITY_MASK, ACTIVE_BIT, RETRY_SHIFT, RETRY_MASK, SUCCESS_BIT, UNBOOTABLE_BIT,
	MAX_PRIORITY, MAX_RETRY,
	getSlotState, makeActivePending, makeInactiveFallback, markSuccessful, markUnbootable, activeSlot,
	planSlotSwitch,
};
