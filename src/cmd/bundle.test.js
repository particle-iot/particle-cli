const path = require('path');
const { expect } = require('../../test/setup');
const BundleCommands = require('./bundle');
const { PATH_FIXTURES_THIRDPARTY_OTA_DIR, PATH_TMP_DIR } = require('../../test/lib/env');
const fs = require('fs-extra');

describe('BundleCommands', () => {
	let bundleCommands ;
	let targetBundlePath;

	beforeEach(async () => {
		bundleCommands = new BundleCommands();
		await fs.ensureDir(PATH_TMP_DIR);
		targetBundlePath = path.join(PATH_TMP_DIR, 'app_bundle_test.zip');
	});

	afterEach(async () => {
		await fs.unlink(targetBundlePath).catch(() => {}); // ignore missing file
	});

	async function runInDirectory(dir, handler) {
		const currentDir = process.cwd();
		try {
			process.chdir(dir);

			return await handler();
		} finally {
			process.chdir(currentDir);
		}
	}

	describe('createBundle', () => {
		it('throws an error if the app binary provided does not exist', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'fake_app.bin');
			const args = {
				params: {
					appBinary: binPath
				},
				assets: undefined,
				saveTo: undefined
			};
			let error;

			try {
				await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', `The file ${binPath} does not exist`);
		});

		it('throws an error if the app binary is not a valid binary', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_bin', 'app.txt');
			const args = {
				params: {
					appBinary: binPath
				},
				assets: undefined,
				saveTo: undefined
			};
			let error;

			try {
				await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', `The file ${binPath} is not a valid binary`);
		});

		it('throws an error if the saveTo parameter is not a zip file', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath
				},
				assets: assetsPath,
				saveTo: 'bundle.txt'
			};
			let error;

			try {
				await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'The target file bundle.txt must be a .zip file');
		});

		it('returns a .zip file', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: targetBundlePath
			};

			const bundleFilename = await bundleCommands.createBundle(args);

			expect(bundleFilename).to.eq(targetBundlePath);
		});

		it('uses the assets in the assets folder when --assets option is not specified', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = undefined;
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: targetBundlePath
			};

			await runInDirectory(path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid'), async () => {
				const bundleFilename = await bundleCommands.createBundle(args);

				expect(bundleFilename).to.eq(targetBundlePath);
			});
		});

		it('uses the assets in the assets folder when --assets option is specified', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: targetBundlePath
			};

			const bundleFilename = await bundleCommands.createBundle(args);

			expect(bundleFilename).to.eq(targetBundlePath);
		});

		it('creates a bundle if there are no assets in the assets folder', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'zero_assets', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'zero_assets', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: targetBundlePath
			};

			const bundleFilename = await bundleCommands.createBundle(args);

			expect(bundleFilename).to.eq(targetBundlePath);
		});

		it('returns bundle with the default name if saveTo argument is not provided', async () => {
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: undefined
			};

			await runInDirectory(PATH_TMP_DIR, async () => {
				const bundleFilename = await bundleCommands.createBundle(args);

				expect(bundleFilename).to.match(/^bundle_app_\d+\.zip$/);

				await fs.unlink(bundleFilename).catch(() => {});
			});
		});
	});

	describe('getAssets', () => {
		it('throws an error when assets folder is not present', async () => {
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_no_assets', 'assets');
			let error;

			try {
				await bundleCommands._getAssets({ assetsPath });
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.eql(`The assets folder ${assetsPath} does not exist`);
		});

		it('returns the assets list', async () => {
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');

			const assetsList = await bundleCommands._getAssets({ assetsPath });

			expect(assetsList).to.be.an.instanceof(Array);
			expect(assetsList).to.have.lengthOf(3);
			expect(assetsList.map(asset => asset.name)).to.eql(['cat.txt', 'house.txt', 'water.txt']);
		});

		it('ignores nested directories', async () => {
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'nested_dir', 'assets');

			const assetsList = await bundleCommands._getAssets({ assetsPath });

			expect(assetsList).to.be.an.instanceof(Array);
			expect(assetsList).to.have.lengthOf(2);
			expect(assetsList.map(asset => asset.name)).to.eql(['file1.txt', 'file2.txt']);
		});

		it('ignores special files', async () => {
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'nested_dir', 'assets');

			const assetsList = await bundleCommands._getAssets({ assetsPath });

			expect(assetsList).to.be.an.instanceof(Array);
			expect(assetsList).to.have.lengthOf(2);
			expect(assetsList.map(asset => asset.name)).to.eql(['file1.txt', 'file2.txt']);
		});

	});

	describe('_getBundleSavePath', () => {
		it ('returns --saveTo argument if provided', async () => {
			const res = await bundleCommands._getBundleSavePath('test.zip', 'test.bin');

			expect(res).to.equal('test.zip');
		});

		it('returns system generated name if --saveTo argument is blank', async () => {
			const res = await bundleCommands._getBundleSavePath(undefined, 'test.bin');

			expect(res).to.match(/^bundle_test_\d+\.zip$/);
		});
	});
});
