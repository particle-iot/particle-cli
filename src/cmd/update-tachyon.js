'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const CLICommandBase = require('./base');
const { getEDLDevice } = require('../lib/tachyon-utils');

const PUBKEY_PATH = path.join(__dirname, '../../assets/keys/particle-tachyon-ota-pub-1.key');

/**
 * Pure planner for an OTA update. Given a parsed/expanded particle_image_v1
 * manifest and the requested mode/slot, decide which partitions get written.
 *   - full  : every partition in the (factory) image.
 *   - slot  : only the target slot's system/efi (group A or B).
 *   - delta : partitions whose payload_sha256 differs from what's on the device
 *             (deviceHashes maps label -> sha256; missing/!= means write).
 * @returns {{mode:string, targetSlot:'a'|'b'|undefined, write:Array, skipped:Array}}
 */
function planUpdate(manifest, { mode = 'slot', slot, deviceHashes = {} } = {}) {
	const group = slot === 'b' ? 'B' : 'A';
	let candidates = manifest.partitions;
	if (mode === 'slot' || mode === 'delta') {
		candidates = candidates.filter((p) => p.group === group);
	}

	const write = [];
	const skipped = [];
	for (const p of candidates) {
		if (mode === 'delta') {
			const prog = (p.ops || []).find((o) => o.op === 'program');
			const want = prog && prog.payload_sha256;
			if (want && deviceHashes[p.label] === want) {
				skipped.push({ label: p.label, reason: 'unchanged' });
				continue;
			}
		}
		write.push(p);
	}
	return { mode, targetSlot: slot, write, skipped };
}

module.exports = class UpdateTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
	}

	async run({ params = {}, slot, mode = 'slot', toggle = false, 'dry-run': dryRun = false, 'no-verify': noVerify = false } = {}) {
		const image = params.image;
		if (!image) {
			throw new Error('usage: particle tachyon update <image.zip> [--slot a|b] [--mode full|slot|delta] [--toggle] [--dry-run]');
		}
		// Lazy-require the shared library so the rest of the CLI loads without it.
		const lib = require('@particle/tachyon-image');

		const manifest = await lib.readManifestFromZip(image);

		if (!noVerify && manifest.signing && manifest.signing.profile !== 'none') {
			const pub = await fs.readFile(PUBKEY_PATH);
			if (!lib.verifyManifest(manifest, pub)) {
				throw new Error('image manifest signature does NOT verify against the bundled Particle key (use --no-verify to override)');
			}
			this.ui.stdout.write(`Signature: OK (key_id=${manifest.signing.key_id || 'unknown'})${os.EOL}`);
		}

		// resolve target slot: explicit, else the image's single present slot, else 'a'
		const targetSlot = slot || (manifest.format.slots_present.length === 1 ? manifest.format.slots_present[0] : undefined);
		if ((mode === 'slot' || mode === 'delta') && !targetSlot) {
			throw new Error(`--mode ${mode} needs --slot a|b (image carries slots: ${manifest.format.slots_present.join(', ')})`);
		}

		// expand to the right view when not doing a full factory write
		let view = manifest;
		if (mode !== 'full') {
			view = lib.expand(manifest, { kind: 'ota-image', slot: targetSlot });
		}

		const plan = planUpdate(view, { mode, slot: targetSlot });
		this._printPlan({ image, plan, toggle });

		if (dryRun) {
			this.ui.stdout.write(`${os.EOL}--dry-run: no device changes.${os.EOL}`);
			return plan;
		}

		// Device write: stream the selected partitions to the inactive/target slot,
		// then optionally toggle. Pending hardware validation — see slot-tachyon.js.
		const device = await getEDLDevice({ ui: this.ui });
		this.ui.stdout.write(`Flashing ${plan.write.length} partitions to device ${device.id} (slot ${targetSlot || 'all'})...${os.EOL}`);
		await this._applyPlan({ image, plan, manifest, device });
		if (toggle && targetSlot) {
			const SlotTachyonCommand = require('./slot-tachyon');
			await new SlotTachyonCommand({ ui: this.ui }).run({ params: { target: targetSlot } });
		}
		return plan;
	}

	_printPlan({ image, plan, toggle }) {
		this.ui.stdout.write(`Update plan for ${path.basename(image)} (mode=${plan.mode}, slot=${plan.targetSlot || 'all'}):${os.EOL}`);
		for (const p of plan.write) {
			this.ui.stdout.write(`  write  ${p.label}${os.EOL}`);
		}
		for (const s of plan.skipped) {
			this.ui.stdout.write(`  skip   ${s.label} (${s.reason})${os.EOL}`);
		}
		if (toggle) {
			this.ui.stdout.write(`  then   switch active slot -> ${plan.targetSlot}${os.EOL}`);
		}
	}

	// eslint-disable-next-line no-unused-vars
	async _applyPlan({ image, plan, manifest, device }) {
		// Hardware-deferred: build a rawprogram from the manifest ops + stream
		// payloads from the zip via QdlFlasher --zip, writing only plan.write
		// partitions. Implemented during hardware bring-up.
		throw new Error('device write is not yet hardware-validated; re-run with --dry-run to preview the plan');
	}
};

module.exports.planUpdate = planUpdate;
