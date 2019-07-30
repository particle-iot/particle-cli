const { expect, sinon } = require('../../test/test-setup');
const hasSupportedNode = require('./has-supported-node');


describe('NodeJS Support Check', () => {
	let exit, console;

	beforeEach(() => {
		exit = sinon.stub();
		console = {
			error: sinon.stub()
		};
	});

	it('does not exit for this test', () => {
		hasSupportedNode({ exit, console });

		expect(exit).not.to.have.been.called;
		expect(console.error).not.to.have.been.called;
	});

	it('does not exit when version requirement is satisfied', () => {
		const json = {
			engines: {
				node: '>= 4.4'
			}
		};
		hasSupportedNode({ version: '8.4.0', json, exit, console });

		expect(exit).not.to.have.been.called;
		expect(console.error).not.to.have.been.called;
	});

	it('exit when version requirement is not satisfied', () => {
		const json = {
			engines: {
				node: '>= 4.4'
			}
		};
		hasSupportedNode({ version: '0.12.0', json, exit, console });

		expect(exit).to.have.been.calledWith(1);
		expect(console.error).to.have.been.called;
	});
});

