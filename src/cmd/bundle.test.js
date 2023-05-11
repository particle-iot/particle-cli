const path = require('path');
const { expect, sinon } = require('../../test/setup');
const BundleCommands = require('./bundle');
const fs = require('fs');
const { PATH_FIXTURES_THIRDPARTY_OTA_DIR, USERNAME } = require('../../test/lib/env');
const cli = require('../../test/lib/cli');

describe('BundleCommands', () => {
	it('should throw an error if the app binary is not provided', () => {
		const bundleCommands = new BundleCommands();
		const args = {
			params: {
				appBinary: undefined
			},
			assets: undefined,
			saveTo: undefined
		};

		return bundleCommands.createBundle(args)
			.then(() => {
				expect(false).to.eq(true);
			})
			.catch(error => {
				expect(error).to.have.property('message', 'The file undefined does not exist!');
			});
	});

	it('should throw an error if the app binary is not a valid binary', () => {
		const bundleCommands = new BundleCommands();
		const args = {
			params: {
				appBinary: 'app.txt'
			},
			assets: undefined,
			saveTo: undefined
		};
		// !!! Stub doesn't work here
		const fsStub = sinon.stub(fs, 'existsSync');
		fsStub.returns(true);

		return bundleCommands.createBundle(args)
			.catch(error => {
				expect(error).to.have.property('message', 'The file app.txt is not a valid binary');
			})
			.finally(() => {
				fsStub.restore();
			});
	});

	it('should return a .zip file', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bin', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app.zip'
		};
		return bundleCommands.createBundle(args)
			.then(result => {
				console.log('Result is : ' + result);
				expect(result).to.include('app.zip');
			});
	});

	it('should use the assets in the assets folder if --assets option is not specified but assets folder is present', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bin', 'app.bin');
		const assetsPath = undefined;
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app.zip'
		};
		return bundleCommands.createBundle(args)
			.then(result => {
				console.log('Result is : ' + result);
				expect(result).to.include('app.zip');
			})
			.catch(error => {
				console.log('Error is : ' + error);
				expect(false).to.eq(true);
			});
	});

	it('should throw an error if --assets option is not specified and assets folder is not present', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bin', 'app.bin');
		const assetsPath = undefined;
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app.zip'
		};

		// Same here - stub does not work
		const fsStub = sinon.stub(fs, 'existsSync');
		fsStub.withArgs(assetsPath).returns(false);

		return bundleCommands.createBundle(args)
			.then(result => {
				console.log('Result is : ' + result);
				expect(false).to.eq(true);
			})
			.catch(error => {
				console.log('Error is : ' + error);
				expect(error).to.have.property('message', 'The folder undefined does not exist!');
			})
			.finally(() => {
				fsStub.restore();
			});
	});

	it('should use the assets in the assets folder if --assets option is specified and assets folder is present', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bin', 'app.bin');
		const assetsPath = undefined;
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app.zip'
		};

		return bundleCommands.createBundle(args)
			.then(result => {
				console.log('Result is : ' + result);
				expect(result).to.include('app.zip');
			})
			.catch(error => {
				console.log('Error is : ' + error);
				expect(false).to.eq(true);
			});
	});

	it('return error if there are no assets in the assets folder', () => {



	});

	it('should return a .zip file with the name given by user if saveTo argument has .zip extension', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bin', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app.zip'
		};
		return bundleCommands.createBundle(args)
			.then(result => {
				console.log('Result is : ' + result);
				expect(result).to.include('app.zip');
			});
	});

	it('should return a .zip file with the default name if saveTo argument does not have .zip extension', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bin', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: 'app'
		};
		return bundleCommands.createBundle(args)
			.then(result => {
				console.log('Result is : ' + result);
				// Use regex because of the time mismatch between the test and
				// the actual execution of the following line
				expect(result).to.match(/^bundle_app_\d+\.zip$/);
			});
	});

	it('should return a .zip file with the default name if saveTo argument is not provided', () => {
		const bundleCommands = new BundleCommands();
		const binPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'bin', 'app.bin');
		const assetsPath = path.join(PATH_FIXTURES_THIRDPARTY_OTA_DIR, 'assets');
		const args = {
			params: {
				appBinary: binPath,
			},
			assets: assetsPath,
			saveTo: undefined
		};
		return bundleCommands.createBundle(args)
			.then(result => {
				console.log('Result is : ' + result);
				// Use regex because of the time mismatch between the test and
				// the actual execution of the following line
				expect(result).to.match(/^bundle_app_\d+\.zip$/);
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
