'use strict';
const { expect, sinon } = require('../../test/setup');
const { CLILibraryTestMigrateCommandSite } = require('./library_migrate');


describe('library command', () => {
	describe('CLILibraryTestMigrateCommandSite', () => {
		const argv = { params: {} };
		const sut = new CLILibraryTestMigrateCommandSite(argv, __dirname);

		it('calls handleError when notifyEnd is called with a non-zero 3rd parameter', () => {

			sut.handleError = sinon.spy();
			sut.notifyEnd('lib', undefined, '123');

			expect(sut.handleError).to.be.calledWith('lib', '123');
		});
	});
});

