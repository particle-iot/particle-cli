'use strict';
const { expect, sinon } = require('../../test/setup');
const { LibraryInitGenerator } = require('particle-library-manager');
const { CLILibraryInitCommandSite } = require('./library_init');
const { LibraryInitCommand } = require('../cmd');


describe('library init command', () => {
	describe('site', () => {
		const sut = new CLILibraryInitCommandSite({});

		it('can instantiate the site', () => {
			return expect(sut).to.be.ok;
		});
	});

	describe('command', () => {
		const sut = new LibraryInitCommand();

		it('can instantiate the command', () => {
			return expect(sut).to.be.ok;
		});

		it.skip('should configure and run the init generator', function doit() {
			this.timeout(18 * 1000);
			const site = {};
			const args = ['args', 'args2'];
			const options = { a:1, b:2, c:3 };
			const env = sinon.stub();
			const run = sinon.stub();
			env.run = (name, options, callback) => {
				run(name, options);
				callback(null); // no error
			};
			site.args = sinon.stub().returns(args);
			site.options = sinon.stub().returns(options);
			site.prompter = sinon.stub();
			// when
			sut.run(null, site)
				.then(() => {
					// expect(result).to.be.equal('result');
					expect(env.registerStub).to.have.been.calledWith(LibraryInitGenerator, 'library:init');
					expect(run).to.have.been.calledWith('library:init');
					expect(site.yeomanEnvironment.createEnv).to.have.been.calledWith(args, options, site.yeomanAdapter);
				});
		});
	});
});

