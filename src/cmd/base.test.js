const { expect } = require('../../test/setup');
const CLICommandBase = require('./base');
const UI = require('../lib/ui');


describe('CLI Command Base Class', () => {
	let cmd;

	beforeEach(() => {
		cmd = new CLICommandBase();
	});

	it('Initializes', () => {
		expect(cmd).to.have.property('stdin', process.stdin);
		expect(cmd).to.have.property('stdout', process.stdout);
		expect(cmd).to.have.property('stderr', process.stderr);
		expect(cmd).to.have.property('ui').that.is.an.instanceof(UI);
		expect(cmd).to.respondTo('showUsageError');
		expect(cmd).to.respondTo('isDeviceId');
	});

	it('Determines if input is a device id', () => {
		expect(cmd.isDeviceId(null)).to.equal(false);
		expect(cmd.isDeviceId(undefined)).to.equal(false);
		expect(cmd.isDeviceId('')).to.equal(false);
		expect(cmd.isDeviceId(666)).to.equal(false);
		expect(cmd.isDeviceId('nope')).to.equal(false);
		expect(cmd.isDeviceId(123456789123456789123456)).to.equal(false);
		expect(cmd.isDeviceId('0123456789abcdef0123456')).to.equal(false);
		expect(cmd.isDeviceId('0123456789abcdef01234567')).to.equal(true);
		expect(cmd.isDeviceId('0123456789ABCDEF01234567')).to.equal(true);
	});

	it('Show a usage error', async () => {
		const promise = cmd.showUsageError('test');

		expect(promise).to.be.an.instanceof(Promise);

		let error;

		try {
			await promise;
		} catch (e){
			error = e;
		}

		expect(error).to.be.an.instanceof(Error);
		expect(error).to.have.property('message', 'test');
	});

	it('Show a product device name usage error', async () => {
		const promise = cmd.showProductDeviceNameUsageError('my-device-name');

		expect(promise).to.be.an.instanceof(Promise);

		let error;

		try {
			await promise;
		} catch (e){
			error = e;
		}

		expect(error).to.be.an.instanceof(Error);
		expect(error).to.have.property('message', '`device` must be an id when `--product` flag is set - received: my-device-name');
	});
});

