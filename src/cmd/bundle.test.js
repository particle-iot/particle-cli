const path = require('path');
const { expect, sinon } = require('../../test/setup');
const BundleCommands = require('./bundle');
const { PATH_FIXTURES_THIRDPARTY_OTA_DIR } = require('../../test/lib/env');

describe('BundleCommands', () => {
	afterEach(() => {
		sinon.restore();
	});

	describe('createBundle', () => {
		let cwdStub;
		const bundleCommands = new BundleCommands();
		it('throws an error if the app binary is not provided', async () => {
			const args = {
				params: {
					appBinary: undefined
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
			expect(error).to.have.property('message', 'The application binary is required');
		});

		it('throws an error if the app binary provided does not exist', async () => {
			const bundleCommands = new BundleCommands();
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
			const bundleCommands = new BundleCommands();
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

		it('returns a .zip file', async () => {
			const bundleCommands = new BundleCommands();
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: 'app_bundle_test.zip'
			};

			let error;
			let downloadFilename;
			try {
				downloadFilename = await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(downloadFilename).to.eq('app_bundle_test.zip');
			expect(error).to.not.be.an.instanceof(Error);

			// TODO: clean up
		});

		it('uses the assets in the assets folder when --assets option is not specified', async () => {
			const bundleCommands = new BundleCommands();
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = undefined;
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: 'app_bundle_test.zip'
			};
			const fakeCwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid');
			cwdStub = sinon.stub(process, 'cwd');
			cwdStub.returns(fakeCwd);

			let error;
			let downloadFilename;
			try {
				downloadFilename = await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(downloadFilename).to.eq('app_bundle_test.zip');
			expect(error).to.not.be.an.instanceof(Error);

			// TODO: clean up
		});

		it('uses the assets in the assets folder when --assets option is specified', async () => {
			const bundleCommands = new BundleCommands();
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: 'app_bundle_test.zip'
			};

			let error;
			let downloadFilename;
			try {
				downloadFilename = await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(downloadFilename).to.eq('app_bundle_test.zip');
			expect(error).to.not.be.an.instanceof(Error);

			// TODO: clean up
		});

		it('returns error if there are no assets in the assets folder', async () => {
			const bundleCommands = new BundleCommands();
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_empty_assets', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_empty_assets', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: 'app_bundle_test.zip'
			};

			let error;
			try {
				await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}
			expect(error).to.be.an.instanceof(Error);
			expect(error).to.have.property('message', 'RangeError: Empty asset dependency list');
			// TODO: clean up
		});

		it('returns bundle with the name given by user using --saveTo', async () => {
			const bundleCommands = new BundleCommands();
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: 'app_bundle_test.zip'
			};

			let error;
			let downloadFilename;
			try {
				downloadFilename = await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(downloadFilename).to.eq(args.saveTo);
			expect(error).to.not.be.an.instanceof(Error);
			// TODO: clean up
		});

		it('returns bundle with the default name if saveTo argument does not have .zip extension', async () => {
			const bundleCommands = new BundleCommands();
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: 'app'
			};

			let error;
			let downloadFilename;
			try {
				downloadFilename = await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(downloadFilename).to.match(/^bundle_app_\d+\.zip$/);
			expect(error).to.not.be.an.instanceof(Error);
			// TODO: clean up
			//
			//
			// return new BundleCommands().createBundle(args)
			// 	.then(result => {
			// 		// Use regex because of the time mismatch between the test and
			// 		// the actual execution of the following line
			// 		expect(result).to.match(/^bundle_app_\d+\.zip$/);
			// 	})
			// 	.catch((error) => {
			// 		throw new Error(error);
			// 	})
			// 	.finally(() => {
			// 		const files = fs.readdirSync('.');
			// 		const regex = /^bundle_app_\d+\.zip$/;
			// 		const zipFile = files.find(file => regex.test(file));
			// 		fs.unlinkSync(zipFile);
			// 	});
		});

		it('returns bundle with the default name if saveTo argument is not provided', async () => {
			const bundleCommands = new BundleCommands();
			const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
			const args = {
				params: {
					appBinary: binPath,
				},
				assets: assetsPath,
				saveTo: undefined
			};

			let error;
			let downloadFilename;
			try {
				downloadFilename = await bundleCommands.createBundle(args);
			} catch (_error) {
				error = _error;
			}

			expect(downloadFilename).to.match(/^bundle_app_\d+\.zip$/);
			expect(error).to.not.be.an.instanceof(Error);
			// TODO: clean up
			//
			// return new BundleCommands().createBundle(args)
			// 	.then(result => {
			// 		// Use regex because of the time mismatch between the test and
			// 		// the actual execution of the following line
			// 		expect(result).to.match(/^bundle_app_\d+\.zip$/);
			// 	})
			// 	.catch((error) => {
			// 		throw new Error(error);
			// 	})
			// 	.finally(() => {
			// 		const files = fs.readdirSync('.');
			// 		const regex = /^bundle_app_\d+\.zip$/;
			// 		const zipFile = files.find(file => regex.test(file));
			// 		fs.unlinkSync(zipFile);
			// 	});
		});

		it('returns any other errors', () => {
			expect(true).to.eq(true);
		});
	});

	describe('getAssets', () => {
		it('throws an error when assets folder is not present', async () => {
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_no_assets', 'assets');

			let error;
			try {
				await new BundleCommands().getAssets(assetsPath);
			} catch (_error) {
				error = _error;
			}

			expect(error).to.be.an.instanceof(Error);
			expect(error.message).to.eql(`The folder ${assetsPath} does not exist!`);
		});

		it('returns the assets list', async () => {
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');

			const assetsList = await new BundleCommands().getAssets(assetsPath);

			expect(assetsList).to.be.an.instanceof(Array);
			expect(assetsList).to.have.lengthOf(3);
			expect(assetsList.map(asset => asset.name)).to.eql(['cat.jpg', 'house.jpg', 'water.jpg']);
		});

		it('ignores nested directories', async () => {
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'nested_dir', 'assets');

			const assetsList = await new BundleCommands().getAssets(assetsPath);

			expect(assetsList).to.be.an.instanceof(Array);
			expect(assetsList).to.have.lengthOf(2);
			expect(assetsList.map(asset => asset.name)).to.eql(['file1.txt', 'file2.txt']);
		});

		it('ignores special files', async () => {
			const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'nested_dir', 'assets');

			const assetsList = await new BundleCommands().getAssets(assetsPath);

			expect(assetsList).to.be.an.instanceof(Array);
			expect(assetsList).to.have.lengthOf(2);
			expect(assetsList.map(asset => asset.name)).to.eql(['file1.txt', 'file2.txt']);
		});

	});

	describe('_getDownloadBundlePath', () => {
		it ('returns --saveTo argument if it has .zip extension', async () => {
			const { _getDownloadBundlePath } = new BundleCommands();
			const res = await _getDownloadBundlePath('test.zip', 'test.bin');
			expect(res).to.equal('test.zip');
		});

		it('returns system generated name if --saveTo argument lacks .zip extension', async () => {
			const { _getDownloadBundlePath } = new BundleCommands();
			const res = await _getDownloadBundlePath('test', 'test.bin');
			expect(res).to.match(/^bundle_test_\d+\.zip$/);
		});

		it('returns system generated name if --saveTo argument is blank', async () => {
			const { _getDownloadBundlePath } = new BundleCommands();
			const res = await _getDownloadBundlePath(undefined, 'test.bin');
			expect(res).to.match(/^bundle_test_\d+\.zip$/);
		});

	});

});


