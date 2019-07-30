const { expect, sinon } = require('../../test/setup');
const hasSupportedNode = require('./has-supported-node');


describe('NodeJS Support Check', () => {
	const sandbox = sinon.createSandbox();
	let fakes;

	beforeEach(() => {
		fakes = {
			exit: () => {},
			console: {
				error: () => {}
			}
		};
		sandbox.stub(fakes, 'exit');
		sandbox.stub(fakes.console, 'error');
	});

	afterEach(() => {
		sandbox.restore();
	});

	it('does not exit for this test', () => {
		const { console, exit } = fakes;

		hasSupportedNode({ console, exit });

		expect(exit).to.have.property('callCount', 0);
		expect(console.error).to.have.property('callCount', 0);
	});

	it('does not exit when version requirement is satisfied', () => {
		const { console, exit } = fakes;
		const json = {
			engines: {
				node: '>= 4.4'
			}
		};

		hasSupportedNode({ version: '8.4.0', json, console, exit });

		expect(exit).to.have.property('callCount', 0);
		expect(console.error).to.have.property('callCount', 0);
	});

	it('exit when version requirement is not satisfied', () => {
		const { console, exit } = fakes;
		const json = {
			engines: {
				node: '>= 4.4'
			}
		};

		hasSupportedNode({ version: '0.12.0', json, console, exit });

		expect(exit).to.have.property('callCount', 1);
		expect(exit.firstCall.args).to.eql([1]);
		expect(console.error).to.have.property('callCount', 1);
		expect(console.error.firstCall.args).to.eql(['The Particle CLI requires Node >= 4.4']);
	});
});

