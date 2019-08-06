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
const { LibraryInitGenerator } = require('particle-library-manager');
const { CLILibraryInitCommandSite } = require('./library_init');
const { LibraryInitCommand } = require('../cmd');


describe('library init command', () => {
	require('yeoman-environment'); // ensure these dynamically loaded modules are loaded before the mock-fs is installed
	require('yeoman-generator');

	describe('site', () => {
		const sut = new CLILibraryInitCommandSite({});

		it('can instantiate the site', () => {
			return expect(sut).to.be.ok;
		});

		it('can retrieve the yeoman adapter', () => {
			return expect(sut.yeomanAdapter()).to.be.ok;
		});
	});

	describe('command', () => {
		const sut = new LibraryInitCommand();

		it('can instantiate the command', () => {
			return expect(sut).to.be.ok;
		});

		it.skip('should configure and run the init generator', function doit() {
			this.timeout(18*1000);
			const site = {};
			const args = ['args', 'args2'];
			const options = { a:1, b:2, c:3 };
			const env = sinon.stub();
			const adapter = 'adapter';
			const run = sinon.stub();
			env.registerStub = sinon.stub();
			env.run = (name, options, callback) => {
				run(name, options);
				callback(null); // no error
			};
			site.yeomanAdapter = sinon.stub().returns(adapter);
			site.args = sinon.stub().returns(args);
			site.options = sinon.stub().returns(options);
			site.yeomanEnvironment = sinon.stub().returns({ createEnv: sinon.stub().returns(env) });
			// when
			sut.run(null, site)
				.then((result) => {
					expect(result).to.be.equal('result');
					expect(env.registerStub).to.have.been.calledWith(LibraryInitGenerator, 'library:init');
					expect(run).to.have.been.calledWith('library:init');
					expect(site.yeomanEnvironment.createEnv).to.have.been.calledWith(args, options, site.yeomanAdapter);
				});
		});
	});
});

