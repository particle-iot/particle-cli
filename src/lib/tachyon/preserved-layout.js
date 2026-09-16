'use strict';
const crypto = require('crypto');
const path = require('path');
const unzip = require('unzipper');

// This matches composer's GPT-preserving QLI payload set. Provisioning, NV,
// persist, misc, GPT and arbitrary firehose operations are never OS payloads.
const allowed = {
	0: ['system', 'efi'],
	1: ['xbl_a', 'xbl_config_a'],
	2: ['xbl_a', 'xbl_config_a'],
	3: ['cdt'],
	6: ['aop_a', 'dtb_a', 'xbl_ramdump_a', 'uefi_a', 'tz_a', 'hyp_a', 'devcfg_a',
		'qupfw_a', 'uefisecapp_a', 'imagefv_a', 'shrm_a', 'core_nhlos_a',
		'multiimgoem_a', 'cpucp_a', 'toolsfv']
};

function integer(value) {
	if (!/^\d+$/.test(value || '') || !Number.isSafeInteger(Number(value))) {
		throw new Error(`Non-finite QLI extent: ${value}`);
	}
	return Number(value);
}

function parsePrograms(xml) {
	let body = xml.replace(/^\s*<\?xml[^?]*\?>/, '').trim();
	if (!body.startsWith('<data>') || !body.endsWith('</data>')) {
		throw new Error('Expected a QLI data/program XML document');
	}
	body = body.slice(6, -7);
	const rows = [];
	body = body.replace(/<program\s+([^<>]*?)\s*\/>/g, (_, attributes) => {
		const row = {};
		const extra = attributes.replace(/([A-Za-z_][A-Za-z_0-9]*)="([^"&<>]*)"/g, (attr, key, value) => {
			if (!['SECTOR_SIZE_IN_BYTES', 'file_sector_offset', 'filename', 'label', 'num_partition_sectors',
				'partofsingleimage', 'physical_partition_number', 'readbackverify', 'size_in_KB',
				'sparse', 'start_byte_hex', 'start_sector'].includes(key)) {
				throw new Error(`Unsupported program attribute ${key}`);
			}
			if (Object.prototype.hasOwnProperty.call(row, key)) {
				throw new Error(`Duplicate program attribute ${key}`);
			}
			row[key] = value;
			return '';
		});
		if (extra.trim()) {
			throw new Error('Unsupported QLI program attributes');
		}
		rows.push(row);
		return '';
	});
	if (body.trim() || !rows.length) {
		throw new Error('QLI image contains an unsupported flash operation');
	}
	return rows;
}

function validatePrograms(rows, table) {
	// An overlapping live GPT would otherwise let an allowed label cover NV/persist.
	for (let lun = 0; lun <= 6; lun++) {
		const partitions = table.filter(p => p.lun === lun && p.partition.name)
			.map(p => p.partition)
			// Qualcomm's factory GPT can contain an empty last_parti terminator.
			// It allocates no sectors. Keep every real partition in the overlap check;
			// last_parti remains forbidden as a payload target below.
			.filter(p => !(p.name === 'last_parti' && p.firstLBA >= 6n && p.lastLBA + 1n === p.firstLBA))
			.sort((a, b) => a.firstLBA < b.firstLBA ? -1 : 1);
		for (let i = 0; i < partitions.length; i++) {
			const p = partitions[i];
			if (p.firstLBA < 6n || p.lastLBA < p.firstLBA || (i && partitions[i - 1].lastLBA >= p.firstLBA)) {
				throw new Error('Invalid or overlapping live GPT partitions');
			}
		}
	}
	const seen = new Set();
	for (const row of rows) {
		const lun = integer(row.physical_partition_number);
		const start = integer(row.start_sector);
		const count = integer(row.num_partition_sectors);
		const key = `${lun}:${row.label}`;
		if (!allowed[lun]?.includes(row.label) || seen.has(key)) {
			throw new Error(`Forbidden or duplicate QLI write: ${key}`);
		}
		seen.add(key);
		if (integer(row.SECTOR_SIZE_IN_BYTES) !== 4096 || !count ||
			integer(row.file_sector_offset || '0') !== 0 || (row.sparse || 'false') !== 'false') {
			throw new Error(`Invalid QLI payload extent: ${key}`);
		}
		if (!row.filename || path.basename(row.filename) !== row.filename || row.filename.includes('\\')) {
			throw new Error('QLI payload must be a plain filename');
		}
		const matches = table.filter(p => p.lun === lun && p.partition.name === row.label);
		if (matches.length !== 1 || BigInt(start) !== matches[0].partition.firstLBA ||
			BigInt(start) + BigInt(count) - 1n > matches[0].partition.lastLBA) {
			throw new Error(`QLI payload does not fit the live partition: ${key}`);
		}
	}
	for (const key of ['0:system', '0:efi', '6:dtb_a', '6:core_nhlos_a']) {
		if (!seen.has(key)) {
			throw new Error(`Missing required QLI payload: ${key}`);
		}
	}
}

async function validateImage(imagePath, table) {
	const archive = await unzip.Open.file(imagePath);
	const entries = new Map();
	for (const entry of archive.files) {
		if (entry.type === 'Directory') {
			continue;
		}
		if (path.basename(entry.path) !== entry.path || entries.has(entry.path)) {
			throw new Error('QLI image must contain unique flat filenames');
		}
		entries.set(entry.path, entry);
	}
	const read = async (name) => {
		if (!entries.has(name)) {
			throw new Error(`Missing QLI image member ${name}`);
		}
		return entries.get(name).buffer();
	};
	const manifest = JSON.parse((await read('manifest.json')).toString());
	const edl = manifest.targets?.[0]?.qcm6490?.edl;
	if (manifest.distribution !== 'qualcomm-linux' || manifest.distribution_version !== '2.0' ||
		manifest.distribution_variant !== 'open' || manifest.variant !== 'headless' ||
		manifest.targets.length !== 1 || edl?.base !== '.' || edl.firehose !== 'prog_firehose_ddr.elf' ||
		JSON.stringify(edl.program_xml) !== '["rawprogram_qli.xml"]' || edl.patch_xml?.length) {
		throw new Error('Unsupported QLI flash manifest');
	}
	for (const name of entries.keys()) {
		if (name.endsWith('.xml') && name !== 'rawprogram_qli.xml') {
			throw new Error(`Unexpected QLI flash XML ${name}`);
		}
	}
	const rows = parsePrograms((await read('rawprogram_qli.xml')).toString());
	validatePrograms(rows, table);
	const checksums = new Map();
	for (const line of (await read('SHA256SUMS')).toString().trim().split('\n')) {
		const match = /^([a-f0-9]{64}) {2}([^/\\]+)$/.exec(line);
		if (!match || checksums.has(match[2])) {
			throw new Error('Invalid QLI checksum manifest');
		}
		checksums.set(match[2], match[1]);
	}
	for (const [name, entry] of entries) {
		if (name === 'SHA256SUMS') {
			continue;
		}
		const hash = crypto.createHash('sha256');
		for await (const chunk of entry.stream()) {
			hash.update(chunk);
		}
		if (hash.digest('hex') !== checksums.get(name)) {
			throw new Error(`QLI checksum mismatch: ${name}`);
		}
	}
	for (const row of rows) {
		const bytes = entries.get(row.filename)?.uncompressedSize;
		if (!bytes || Math.ceil(bytes / 4096) !== Number(row.num_partition_sectors)) {
			throw new Error(`Missing or incorrectly bounded QLI payload: ${row.filename}`);
		}
	}
}

module.exports = { parsePrograms, validatePrograms, validateImage };
