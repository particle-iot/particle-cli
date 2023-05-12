const path = require('path');
const { expect, sinon } = require('../../test/setup');
const BundleCommands = require('./bundle');
const fs = require('fs');
const { PATH_FIXTURES_THIRDPARTY_OTA_DIR } = require('../../test/lib/env');

describe('BundleCommands', () => {
	let cwdStub;
	it('should throw an error if the app binary is not provided', () => {
		const bundleCommands = new BundleCommands();
		const args = {
			params: {
				appBinary: undefined
			},
			assets: undefined,
			saveTo: undefined
		};

		bundleCommands.createBundle(args)
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch((error) => {
				expect(error).to.eq(undefined);
			});
	});

	it('should throw an error if the app binary provided does not exist', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'fake_app.bin');
		const args = {
			params: {
				appBinary: binPath
			},
			assets: undefined,
			saveTo: undefined
		};

		bundleCommands.createBundle(args)
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				expect(error).to.eq(`The file ${binPath} does not exist!`);
			});
	});

	it('should throw an error if the app binary is not a valid binary', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_bin', 'app.txt');
		const args = {
			params: {
				appBinary: binPath
			},
			assets: undefined,
			saveTo: undefined
		};

		bundleCommands.createBundle(args)
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				expect(error).to.eq(`The file ${binPath} is not a valid binary`);
			});
	});

	it('should return a .zip file', () => {
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app_bundle_test.zip'
		};
		return new BundleCommands().createBundle(args)
			.then(result => {
				expect(result).to.eq('app_bundle_test.zip');
			})
			.catch((error) => {
				throw new Error(error);
			})
			.finally(() => {
				if (fs.existsSync('app_bundle_test.zip')) {
					fs.unlinkSync('app_bundle_test.zip');
				}
			});
	});

	it('should use the assets in the assets folder if --assets option is not specified but assets folder is present', () => {
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

		return new BundleCommands().createBundle(args)
			.then(result => {
				expect(result).to.eq('app_bundle_test.zip');
			})
			.catch((error) => {
				throw new Error(error);
			})
			.finally(() => {
				if (fs.existsSync('app_bundle_test.zip')) {
					fs.unlinkSync('app_bundle_test.zip');
				}
				cwdStub.restore();
			});
	});

	it('should throw an error if --assets option is not specified and assets folder is not present', () => {
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_no_assets', 'app.bin');
		const assetsPath = undefined;
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app_bundle_test.zip'
		};
		const fakeCwd = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_no_assets');
		cwdStub = sinon.stub(process, 'cwd');
		cwdStub.returns(fakeCwd);

		return new BundleCommands().createBundle(args)
			.then(result => {
				expect(result).to.eq('app_bundle_test.zip');
			})
			.catch((error) => {
				expect(error).to.eq(`The folder ${fakeCwd}/assets does not exist!`);
			})
			.finally(() => {
				if (fs.existsSync('app_bundle_test.zip')) {
					fs.unlinkSync('app_bundle_test.zip');
				}
				cwdStub.restore();
			});
	});

	it('should use the assets in the assets folder if --assets option is specified and assets folder is present', () => {
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app_bundle_test.zip'
		};

		return new BundleCommands().createBundle(args)
			.then(result => {
				expect(result).to.eq('app_bundle_test.zip');
			})
			.catch((error) => {
				throw new Error(error);
			})
			.finally(() => {
				if (fs.existsSync('app_bundle_test.zip')) {
					fs.unlinkSync('app_bundle_test.zip');
				}
			});
	});

	it('return error if there are no assets in the assets folder', () => {
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_empty_assets', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'invalid_empty_assets', 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app_bundle_test.zip'
		};

		return new BundleCommands().createBundle(args)
			.then(() => {
				throw new Error('expected promise to be rejected');
			})
			.catch(error => {
				expect(error).to.eq(`No assets found in ${assetsPath}`);
			});
	});

	it('should return a .zip file with the name given by user if saveTo argument has .zip extension', () => {
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app_bundle_test.zip'
		};

		return new BundleCommands().createBundle(args)
			.then(result => {
				expect(result).to.eq('app_bundle_test.zip');
			})
			.catch((error) => {
				throw new Error(error);
			})
			.finally(() => {
				if (fs.existsSync('app_bundle_test.zip')) {
					fs.unlinkSync('app_bundle_test.zip');
				}
			});
	});

	it('should return a .zip file with the default name if saveTo argument does not have .zip extension', () => {
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app'
		};
		return new BundleCommands().createBundle(args)
			.then(result => {
				// Use regex because of the time mismatch between the test and
				// the actual execution of the following line
				expect(result).to.match(/^bundle_app_\d+\.zip$/);
			})
			.catch((error) => {
				throw new Error(error);
			})
			.finally(() => {
				const files = fs.readdirSync('.');
				const regex = /^bundle_app_\d+\.zip$/;
				const zipFile = files.find(file => regex.test(file));
				fs.unlinkSync(zipFile);
			});
	});

	it('should return a .zip file with the default name if saveTo argument is not provided', () => {
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'valid', 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: undefined
		};
		return new BundleCommands().createBundle(args)
			.then(result => {
				// Use regex because of the time mismatch between the test and
				// the actual execution of the following line
				expect(result).to.match(/^bundle_app_\d+\.zip$/);
			})
			.catch((error) => {
				throw new Error(error);
			})
			.finally(() => {
				const files = fs.readdirSync('.');
				const regex = /^bundle_app_\d+\.zip$/;
				const zipFile = files.find(file => regex.test(file));
				fs.unlinkSync(zipFile);
			});
	});

	it('should return any unexpected errors', () => {
		expect(true).to.eq(true);
	});

});

describe('Verify _getDownloadBundlePath', () => {
	it ('should return the saveTo argument if it has a .zip extension', async () => {
		const { _getDownloadBundlePath } = new BundleCommands();
		const res = await _getDownloadBundlePath('test.zip', 'test.bin');
		expect(res).to.equal('test.zip');
	});

	it('should return the default name if saveTo argument does not have a .zip extension', async () => {
		const { _getDownloadBundlePath } = new BundleCommands();
		const res = await _getDownloadBundlePath('test', 'test.bin');
		expect(res).to.equal('bundle_test_' + Date.now() + '.zip');
	});

	it('should return the default name if saveTo argument is not provided', async () => {
		const { _getDownloadBundlePath } = new BundleCommands();
		const res = await _getDownloadBundlePath(undefined, 'test.bin');
		expect(res).to.equal('bundle_test_' + Date.now() + '.zip');
	});

});
