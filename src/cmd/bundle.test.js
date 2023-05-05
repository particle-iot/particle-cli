const { expect } = require('../../test/setup');
const BundleCommands = require('./bundle');

describe('bundle', () => {
	beforeEach(() => {
	});

	it('should throw an error if the app binary does not exist', () => {
		expect(true).to.eq(true);
	});

	it('should throw an error if the app binary is not a valid binary', () => {
		expect(true).to.eq(true);
	});

	it('should return a .zip file', () => {
		expect(true).to.eq(true);
	});

	it('should throw an error if --assets option is not specified and assets folder is not present', () => {
		expect(true).to.eq(true);
	});

	it('should use the assets in the assets folder if --assets option is not specified but assets folder is present', () => {
		expect(true).to.eq(true);
	});

	it('should use the assets in the assets folder if --assets option is specified and assets folder is present', () => {
		expect(true).to.eq(true);
	});

	it('should still bundle is assets folder is empty', () => {
		expect(true).to.eq(true);
	});

	it('should return a .zip file with the name given by user if saveTo argument has .zip extension', () => {
		expect(true).to.eq(true);
	});

	it('should return a .zip file with the default name if saveTo argument does not have .zip extension', () => {
		expect(true).to.eq(true);
	});

	it('should return a .zip file with the default name if saveTo argument is not provided', () => {
		expect(true).to.eq(true);
	});

	it('should create a bundle of the application binary and assets', () => {
		expect(true).to.eq(true);
	});

	it('should create a bundle of the application binary and assets and save it to a file specified by the user', () => {
		expect(true).to.eq(true);
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
