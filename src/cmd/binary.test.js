const BinaryCommand = require('../cmd/binary');
const { expect } = require('../../test/setup');
const path = require('path');
const fs = require('fs-extra');
const { PATH_FIXTURES_THIRDPARTY_OTA_DIR, PATH_FIXTURES_BINARIES_DIR } = require('../../test/lib/env');
describe('Binary Inspect', () => {
	let binaryCommand;

	beforeEach(async () => {
		binaryCommand = new BinaryCommand();
	});

	describe('__checkFile', () => {
		it('errors if file does not exist', async () => {
			let error;

			try {
				await binaryCommand._checkFile('does-not-exist.bin');
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.equal('File does not exist: does-not-exist.bin');
		});

		it('returns nothing if file exists', async () => {
			let res = false;
			try {
				res = await binaryCommand._checkFile(path.join(PATH_FIXTURES_BINARIES_DIR, 'argon_stroby.bin'));
			} catch (err) {
				// ignore error
			}

			expect(res).to.equal(true);
		});
	});

	describe('_extractFiles', () => {
		it('errors if file is not .zip or .bin', async () => {
			let error;

			try {
				await binaryCommand._extractFiles('not-a-zip-or-bin-file');
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.equal('File must be a .bin or .zip file: not-a-zip-or-bin-file');
		});

		it('extracts a .zip file', async () => {
			const zipPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle.zip');

			const binaryInfo = await binaryCommand._extractFiles(zipPath);

			expect(binaryInfo).to.have.property('application').with.property('name', 'app.bin');
			expect(binaryInfo).to.have.property('assets').with.lengthOf(3);
			expect(binaryInfo.assets.map(a => a.name)).to.eql(['cat.txt', 'house.txt', 'water.txt']);
		});

		xit('errors out if the .zip file does not contain a .bin', async () => {
			// TODO
		});

		it('extracts a .bin file', async () => {
			const binPath = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon_stroby.bin');

			const binaryInfo = await binaryCommand._extractFiles(binPath);

			expect(binaryInfo).to.have.property('application').with.property('name', 'argon_stroby.bin');
			expect(binaryInfo).to.have.property('assets').with.lengthOf(0);
		});

		it('handles if zip file does not have a binary or assets', async () => {
			const zipPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid-bundle.zip');

			const binaryInfo = await binaryCommand._extractFiles(zipPath);

			expect(binaryInfo).to.have.property('application').with.property('name', 'app.txt');
			expect(binaryInfo).to.have.property('assets').with.lengthOf(0);

		});
	});

	describe('_parseApplicationBinary', () => {
		it('parses a .bin file', async () => {
			const name = 'argon_stroby.bin';
			const data = await fs.readFile(path.join(PATH_FIXTURES_BINARIES_DIR, name));
			const applicationBinary = { name, data };

			const res = await binaryCommand._parseApplicationBinary(applicationBinary);

			expect(path.basename(res.filename)).to.equal('argon_stroby.bin');
			expect(res.crc.ok).to.equal(true);
			expect(res).to.have.property('prefixInfo');
			expect(res).to.have.property('suffixInfo');
		});

		it('errors if the binary is not valid', async () => {
			const applicationBinary = { name: 'junk', data: Buffer.from('junk') };

			let error;
			try {
				await binaryCommand._parseApplicationBinary(applicationBinary);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.match(/Could not parse junk/);
		});
	});

	describe('_verifyBundle', () => {
		it('verifies bundle with asset info', async () => {
			const zipPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle.zip');
			const res = await binaryCommand._extractFiles(zipPath);
			const parsedBinaryInfo = await binaryCommand._parseApplicationBinary(res.application);

			const verify = await binaryCommand._verifyBundle(parsedBinaryInfo, res.assets);

			expect(verify).to.equal(true);
		});
	});
});

