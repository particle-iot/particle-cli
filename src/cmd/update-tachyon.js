'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const temp = require('temp').track();
const unzipper = require('unzipper');
const CLICommandBase = require('./base');
const QdlFlasher = require('../lib/qdl');
const { getEDLDevice, initFiles, addLogHeaders, addLogFooter } = require('../lib/tachyon-utils');

/** Extract a single entry from a zip to destPath (used to pull the provisioning XML out of the image). */
async function extractZipEntry(zipPath, entryName, destPath) {
	const dir = await unzipper.Open.file(zipPath);
	const entry = dir.files.find((f) => f.path === entryName);
	if (!entry) {
		throw new Error(`provisioning file "${entryName}" not found in ${path.basename(zipPath)}`);
	}
	await new Promise((resolve, reject) =>
		entry.stream().pipe(fs.createWriteStream(destPath)).on('finish', resolve).on('error', reject));
	return destPath;
}

const PUBKEY_PATH = path.join(__dirname, '../../assets/keys/particle-tachyon-ota-pub-1.key');

// ops qdl actually acts on; a `reserve` op (filename="") is inert and skipped.
const ACTIONABLE_OPS = new Set(['program', 'erase', 'zero', 'gpt', 'patch']);

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
		// A partition with no op that qdl acts on is declared but never written
		// (e.g. NV preserved under factory mode = reserve-only, or a GPT-defined
		// userdata with no payload). `reserve` is inert; qdl skips filename="".
		const actionable = (p.ops || []).filter((o) => ACTIONABLE_OPS.has(o.op));
		if (actionable.length === 0) {
			skipped.push({ label: p.label, reason: 'preserved (no-op)' });
			continue;
		}
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

	async run({ params = {}, slot, mode = 'slot', toggle = false, 'dry-run': dryRun = false, 'no-verify': noVerify = false, 'factory-blank': factoryBlank = false } = {}) {
		const image = params.image;
		if (!image) {
			throw new Error('usage: particle tachyon update <image.zip> [--slot a|b] [--mode factory|slot|delta|erase] [--toggle] [--dry-run]');
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
		if ((mode === 'slot' || mode === 'delta' || mode === 'erase') && !targetSlot) {
			throw new Error(`--mode ${mode} needs --slot a|b (image carries slots: ${manifest.format.slots_present.join(', ')})`);
		}

		// expand to the right view.
		//  - factory : whole-image write. Preserves NV (modem calibration / IMEI) and
		//              erases slot B; re-provisions the UFS LUN geometry first (see
		//              _applyPlan). `--factory-blank` also blanks NV.
		//  - erase   : blank just the target slot (its OS/boot/firmware), nothing else.
		//  - slot/delta : the target slot's OS only.
		let view;
		if (mode === 'factory') {
			view = lib.expand(manifest, { kind: factoryBlank ? 'factory_blank' : 'factory' });
		} else if (mode === 'erase') {
			view = lib.eraseSlotView(manifest, targetSlot);
		} else {
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
		// A factory flash re-provisions the UFS LUN geometry (the A/B layout changed it)
		// and preserves modem NV across that reset; OTA modes leave provisioning alone.
		await this._applyPlan({ image, plan, manifest, device, provision: mode === 'factory' });
		if (toggle && targetSlot) {
			const SlotTachyonCommand = require('./slot-tachyon');
			await new SlotTachyonCommand({ ui: this.ui }).run({ params: { target: targetSlot } });
		}
		return plan;
	}

	_printPlan({ image, plan, toggle }) {
		this.ui.stdout.write(`Update plan for ${path.basename(image)} (mode=${plan.mode}, slot=${plan.targetSlot || 'all'}):${os.EOL}`);
		for (const p of plan.write) {
			// distinguish a destructive erase (e.g. the inactive slot) from a program
			const acts = (p.ops || []).filter((o) => ACTIONABLE_OPS.has(o.op));
			const action = acts.length && acts.every((o) => o.op === 'erase') ? 'erase ' : 'program';
			this.ui.stdout.write(`  ${action} ${p.label}${os.EOL}`);
		}
		for (const s of plan.skipped) {
			this.ui.stdout.write(`  skip    ${s.label} (${s.reason})${os.EOL}`);
		}
		if (toggle) {
			this.ui.stdout.write(`  then   switch active slot -> ${plan.targetSlot}${os.EOL}`);
		}
	}

	async _applyPlan({ image, plan, manifest, device, provision = false }) {
		const lib = require('@particle/tachyon-image');
		const { firehosePath } = await initFiles();

		// Factory provisioning: the A/B layout changed the UFS LUN geometry (LUN count
		// and sizes), which a plain program flash cannot change — so a `factory` flash
		// must re-provision first or large writes (e.g. the NON-HLOS modem) run off the
		// device's old LUN boundary and the firehose wedges. Provisioning recreates the
		// LUNs (including LUN5 / NV), so to keep modem calibration we do:
		//   backup NV -> provision -> flash -> restore NV.
		let nvBackupZip;
		if (provision && manifest.provision) {
			const BackupRestoreTachyonCommand = require('./backup-restore-tachyon');
			const nvDir = await temp.mkdir('tachyon-nv');
			this.ui.stdout.write(`Backing up NV (modem calibration) before provisioning...${os.EOL}`);
			await new BackupRestoreTachyonCommand({ ui: this.ui }).backup({ 'output-dir': nvDir });
			nvBackupZip = path.join(nvDir, `manufacturing_backup_${device.id}.zip`);

			const provDir = await temp.mkdir('tachyon-prov');
			const provPath = path.join(provDir, path.basename(manifest.provision));
			await extractZipEntry(path.resolve(image), manifest.provision, provPath);
			this.ui.stdout.write(`Provisioning UFS LUN geometry (${manifest.provision})...${os.EOL}`);
			// One qdl session: qdl detects the <ufs> tags, provisions, and exits. No
			// --finalize-provisioning (that is only for an irreversible bConfigDescrLock=1
			// OTP lock; our XML keeps it re-provisionable).
			const provLog = path.join(os.tmpdir(), `tachyon_${device.id}_provision_${Date.now()}.log`);
			await new QdlFlasher({
				files: [firehosePath, provPath],
				includeDir: provDir,
				ui: this.ui,
				outputLogFile: provLog,
				skipReset: true,
				currTask: 'PROVISION',
				serialNumber: device.serialNumber,
			}).run();
		}

		// Rebuild faithful rawprogram (+ patch) XML from the manifest ops for the
		// partitions we are writing. The manifest is geometry-complete, so no device
		// GPT read is needed — and that is also correct when the layout changes.
		//
		// Emit one rawprogram/patch PER LUN, in LUN order, with each LUN's data
		// written before its GPT — matching the stock factory layout. A single
		// combined rawprogram (GPTs rewritten mid-stream, LUN switches churned)
		// wedged the firehose on the NON-HLOS modem write.
		const view = { ...manifest, partitions: plan.write };
		const perLun = lib.toRawProgramPerLun(view);

		const tmp = await temp.mkdir('tachyon-ota');
		const programFiles = [];
		const patchFiles = [];
		for (const { lun, program, patch } of perLun) {
			const rp = path.join(tmp, `rawprogram${lun}.xml`);
			await fs.writeFile(rp, program);
			programFiles.push(rp);
			if (/<patch\b/.test(patch)) {
				const pp = path.join(tmp, `patch${lun}.xml`);
				await fs.writeFile(pp, patch);
				patchFiles.push(pp);
			}
		}
		// firehose, then all rawprograms (LUN order), then all patches — like flashTachyon.
		const files = [firehosePath, ...programFiles, ...patchFiles];

		const outputLog = path.join(os.tmpdir(), `tachyon_${device.id}_ota_${Date.now()}.log`);
		this.ui.stdout.write(`Logs will be saved to ${outputLog}${os.EOL}`);
		const startTime = new Date();
		addLogHeaders({ outputLog, startTime, deviceId: device.id, commandName: 'Tachyon OTA update' });

		// qdl resolves each payload (op.source: rootfs.ext4, efi.img, gpt_main0.bin …)
		// from the image zip via --zip, so the 9GB+ archive is never extracted.
		const qdl = new QdlFlasher({
			files,
			updateFolder: path.dirname(path.resolve(image)),
			zip: path.basename(image),
			ui: this.ui,
			outputLogFile: outputLog,
			skipReset: true,
			currTask: 'OTA',
			serialNumber: device.serialNumber,
		});
		await qdl.run();
		addLogFooter({ outputLog, startTime, endTime: new Date() });

		// Restore the modem NV we saved before provisioning, onto the freshly-laid-down
		// LUN5 of the new layout — so a factory reflash keeps calibration / IMEI.
		if (nvBackupZip) {
			const BackupRestoreTachyonCommand = require('./backup-restore-tachyon');
			this.ui.stdout.write(`Restoring NV (modem calibration)...${os.EOL}`);
			await new BackupRestoreTachyonCommand({ ui: this.ui }).restore({ filepath: nvBackupZip });
		}
	}
};

module.exports.planUpdate = planUpdate;
