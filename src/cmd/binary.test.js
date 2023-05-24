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
		afterEach(async () => {
			await fs.readdir('.', (err, files) => {
				files.forEach(async (file) => {
					if (file.startsWith('temp-dir-for-assets')) {
						await fs.remove(file);
					}
				});
			});
		});

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
			let bin;
			let assets;

			try {
				[bin, assets] = await binaryCommand._extractFiles(zipPath);
			} catch (err) {
				// ignore error
			}

			expect(path.basename(bin)).to.equal('app.bin');
			assets.forEach((asset) => {
				expect(path.basename(asset)).to.be.oneOf(['cat.txt', 'house.txt', 'water.txt']);
			});
		});

		it('extracts a .bin file', async () => {
			const binPath = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon_stroby.bin');
			let bin;
			let assets;

			try {
				[bin, assets] = await binaryCommand._extractFiles(binPath);
			} catch (err) {
				// ignore error
			}

			expect(path.basename(bin)).to.equal('argon_stroby.bin');
			expect(assets.length).to.equal(0);
		});

		it('handles if zip file does not have a binary or assets', async () => {
			const zipPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid-bundle.zip');
			let bin;
			let assets;

			[bin, assets] = await binaryCommand._extractFiles(zipPath);

			expect(bin).to.equal(undefined);
			expect(assets.length).to.equal(0);

		});
	});

	describe('__extractZip', () => {
		afterEach(async () => {
			await fs.readdir('.', (err, files) => {
				files.forEach(async (file) => {
					if (file.startsWith('temp-dir-for-assets')) {
						await fs.remove(file);
					}
				});
			});
		});

		it('checks if the file is a zip file', async () => {
			let error;

			try {
				await binaryCommand._extractZip('not-a-zip-file');
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.equal('File must be a .zip file: not-a-zip-file');
		});

		it('extracts a .zip file', async () => {
			const zipPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle.zip');
			let resDir;

			try {
				resDir = await binaryCommand._extractZip(zipPath);
			} catch (err) {
				// ignore error
			}

			expect(path.basename(resDir)).to.match(/^temp-dir-for-assets/);
		});

		it('returns error if fails to unzip', async () => {
			const zipPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'random-bad-bundle.zip');
			let error;
			let resDir;


			try {
				resDir = await binaryCommand._extractZip(zipPath);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.include(`Could not extract ${zipPath}`);
		});
	});

	describe('_parseBinaryFile', () => {
		it('parses a .bin file', async () => {
			const binPath = path.join(PATH_FIXTURES_BINARIES_DIR, 'argon_stroby.bin');

			const res = await binaryCommand._parseBinaryFile(binPath);

			expect(path.basename(res.filename)).to.equal('argon_stroby.bin');
			expect(res.crc.ok).to.equal(true);
			expect(res).to.have.property('prefixInfo');
			expect(res).to.have.property('suffixInfo');
		});

		it('errors if file does not exist', async () => {
			const binPath = '';
			let error;

			try {
				await binaryCommand._parseBinaryFile(binPath);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.equal(`File does not exist: ${binPath}`);
		});

		it('errors if file is not a .bin', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_bin', 'app.txt');
			let error;

			try {
				await binaryCommand._parseBinaryFile(binPath);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.equal(`File must be a .bin file: ${binPath}`);
		});

		it('errors for  non valid binary', async () => {
			// TODO: return error 'Could not parse'
		});

	});

	describe('_verifyBundle', () => {
		it('verifies bundle with asset info', async () => {
			const zipPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bundle.zip');
			const [bin, assets] = await binaryCommand._extractFiles(zipPath);
			const parsedBinaryInfo = await binaryCommand._parseBinaryFile(bin);

			const res = await binaryCommand._verifyBundle(parsedBinaryInfo, assets);

			expect(res).to.equal(true);
		});

		it('checks only if assets are present', async () => {
			const assets = [];
			const res = await binaryCommand._verifyBundle('', assets);

			expect(res).to.equal(undefined);
		});
	});

	describe('_getHash', () => {
		it('returns hash of file', async () => {
			// currently using sha256
			const file = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets', 'cat.txt');
			const res = await binaryCommand._getHash(file);
			expect(res).to.equal('45c253278a957abf8f085c8fd3a0af07a721f6d4b3283e3b6a8587ed3e784d8b');
		});
	});
});

