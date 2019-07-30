/*
 ******************************************************************************
 Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

 This program is free software; you can redistribute it and/or
 modify it under the terms of the GNU Lesser General Public
 License as published by the Free Software Foundation, either
 version 3 of the License, or (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public
 License along with this program; if not, see <http://www.gnu.org/licenses/>.
 ******************************************************************************
 */

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

