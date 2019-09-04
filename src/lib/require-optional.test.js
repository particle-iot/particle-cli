const { expect, sinon } = require('../../test/setup');
const { withConsoleStubs } = require('../../test/lib/mocha-utils');


describe('Require Optional', () => {
	const sandbox = sinon.createSandbox();

	afterEach(() => {
		sandbox.restore();
	});

	it('Requires optional dependency', () => {
		const usb = require('particle-usb');
		const usbOpt = require('./require-optional')('particle-usb');

		expect(usb).to.exist;
		expect(usbOpt).to.equal(usb);
	});

	it('Throws when dependency cannot be loaded', withConsoleStubs(sandbox, () => {
		let error;

		try {
			require('./require-optional')('WATNOPE');
		} catch (e){
			error = e;
		}

		expect(error).to.an.instanceof(Error);
		expect(error).to.have.property('message', 'Cannot find module \'WATNOPE\'');
		expect(process.stdout.write).to.have.callCount(0);
		expect(process.stderr.write).to.have.callCount(2);

		const messages = process.stderr.write.args.map(a => a[0]);

		expect(messages[0]).to.include('The `WATNOPE` dependency is missing or invalid.');
		expect(messages[1]).to.include('Please reinstall: https://docs.particle.io/tutorials/developer-tools/cli/#installing');
	}));
});

