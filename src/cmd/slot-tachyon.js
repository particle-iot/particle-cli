'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const temp = require('temp').track();
const GPT = require('gpt');
const CLICommandBase = require('./base');
const QdlFlasher = require('../lib/qdl');
const settings = require('../../settings');
const {
	addLogHeaders,
	addLogFooter,
	getEDLDevice,
	prepareFlashFiles,
	generateXml,
	handleFlashError,
} = require('../lib/tachyon-utils');
const { getSlotState, planSlotSwitch } = require('../lib/tachyon-slots');

// Slot-bearing partitions whose GPT attribute bits select the boot slot. We read
// the whole device GPT and act on every `_a`/`_b` partition we find.
const SLOT_RE = /_(a|b)$/;

module.exports = class SlotTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
		this._logsDir = path.join(settings.ensureFolder(), 'logs');
	}

	async run({ params = {}, 'dry-run': dryRun = false, 'log-dir': logDir = this._logsDir } = {}) {
		const target = params.target; // 'a' | 'b' | undefined (show only)
		const device = await getEDLDevice({ ui: this.ui });
		await fs.ensureDir(logDir);
		const startTime = new Date();
		const outputLog = path.join(logDir, `tachyon_${device.id}_slot_${Date.now()}.log`);
		addLogHeaders({ outputLog, startTime, deviceId: device.id, commandName: 'Tachyon slot' });

		try {
			const tmp = await temp.mkdir('tachyon_slot');
			// read the device GPT (partitionTable spans all LUNs)
			const { partitionTable } = await prepareFlashFiles({
				logFile: outputLog,
				ui: this.ui,
				partitionsList: ['system_a'], // any present partition; we only need the GPT
				dir: tmp,
				device,
				operation: 'read',
			});

			const slotParts = partitionTable
				.filter((e) => SLOT_RE.test(e.partition.name))
				.map((e) => ({
					label: e.partition.name,
					lun: e.lun,
					slot: SLOT_RE.exec(e.partition.name)[1],
					attr: BigInt(e.partition.attr || 0),
				}));

			if (!slotParts.length) {
				throw new Error('no A/B (_a/_b) partitions found in the device GPT');
			}

			this._printStatus(slotParts);

			if (!target) {
				return; // show-only
			}

			const plan = planSlotSwitch(slotParts, target);
			this._printPlan(plan);

			if (!plan.changes.length) {
				this.ui.stdout.write(`Slot '${target}' is already active; nothing to do.${os.EOL}`);
				return;
			}
			if (dryRun) {
				this.ui.stdout.write(`${os.EOL}--dry-run: no changes written.${os.EOL}`);
				return;
			}

			await this._applyPlan({ plan, tmp, device, outputLog });
			this.ui.stdout.write(`${os.EOL}Active slot set to '${target}'. Reboot the device to boot it.${os.EOL}`);
		} catch (error) {
			await handleFlashError({ error, ui: this.ui });
			throw error;
		} finally {
			addLogFooter({ outputLog, startTime, endTime: new Date() });
		}
	}

	_printStatus(slotParts) {
		const sys = slotParts.filter((p) => /^system_[ab]$/.test(p.label));
		this.ui.stdout.write(`Tachyon A/B slots:${os.EOL}`);
		for (const p of (sys.length ? sys : slotParts)) {
			const s = getSlotState(p.attr);
			this.ui.stdout.write(
				`  ${p.label}: priority=${s.priority} active=${s.active} retries=${s.retries} ` +
        `success=${s.success} unbootable=${s.unbootable}${os.EOL}`,
			);
		}
	}

	_printPlan(plan) {
		this.ui.stdout.write(`${os.EOL}Current active slot: ${plan.current} -> target: ${plan.target}${os.EOL}`);
		for (const c of plan.changes) {
			this.ui.stdout.write(
				`  ${c.label} (lun ${c.lun}): attr 0x${c.fromAttr.toString(16)} -> 0x${c.toAttr.toString(16)}${os.EOL}`,
			);
		}
	}

	/**
   * Rewrite the affected LUNs' GPTs with the new attribute bits and program them.
   * NOTE: the device-write path is pending hardware validation (and confirmation
   * of the attribute bit positions vs the BP PartitionTableUpdate.h). Use
   * --dry-run to inspect the plan safely.
   */
	async _applyPlan({ plan, tmp, device, outputLog }) {
		const lunsChanged = [...new Set(plan.changes.map((c) => c.lun))];
		const programEntries = [];
		for (const lun of lunsChanged) {
			const mainPath = path.join(tmp, `gpt_main${lun}.bin`);
			const buf = await fs.readFile(mainPath);
			const gpt = new GPT({ blockSize: 4096 });
			const parsed = gpt.parse(buf, gpt.blockSize);
			for (const c of plan.changes.filter((x) => x.lun === lun)) {
				const p = parsed.partitions.find((pp) => pp.name === c.label);
				if (p) {
					p.attr = c.toAttr;
				}
			}
			gpt.partitions = parsed.partitions;
			const primary = gpt.write();
			const backup = gpt.writeBackupFromPrimary ? gpt.writeBackupFromPrimary(primary) : gpt.writeBackup();
			const mainOut = path.join(tmp, `gpt_main${lun}.patched.bin`);
			const backupOut = path.join(tmp, `gpt_backup${lun}.patched.bin`);
			await fs.writeFile(mainOut, primary);
			await fs.writeFile(backupOut, backup);
			programEntries.push(
				{ label: 'PrimaryGPT', physical_partition_number: lun, start_sector: 0, num_partition_sectors: Math.ceil(primary.length / 4096), filename: mainOut },
			);
		}

		const xmlFile = await generateXml({ partitions: programEntries, operation: 'program', tempPath: tmp });
		const { firehosePath } = await prepareFlashFiles({
			logFile: outputLog, ui: this.ui, partitionsList: ['system_a'], dir: tmp, device, operation: 'read',
		});
		const qdl = new QdlFlasher({
			outputLogFile: outputLog,
			files: [firehosePath, xmlFile],
			ui: this.ui,
			currTask: 'SlotSwitch',
			skipReset: true,
			serialNumber: device.serialNumber,
		});
		await qdl.run();
	}
};
