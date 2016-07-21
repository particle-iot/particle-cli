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

const chai = require('chai');
const sinon = require('sinon');
chai.use(require('sinon-chai'));
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const path = require('path');
import { CLILibraryInitCommandSite } from '../../src/cmd/library_init';
import { LibraryInitGenerator } from 'particle-cli-library-manager';
import { LibraryInitCommand } from '../../src/lib/library_init';


describe('library init command', () => {

	describe('site', () => {
		const sut = new CLILibraryInitCommandSite({});

		it('can instantiate the site', () => {
			return expect(sut).to.be.ok;
		});

		it('can retrieve the yeoman adapter', () => {
			return expect(sut.yeomanAdapter()).to.be.ok;
		})
	});

	describe('command', () => {
		const sut = new LibraryInitCommand();

		it('can instantiate the command', () => {
			return expect(sut).to.be.ok;
		});
		
		it('should configure and run the init generator', () => {
			const site = {};
			const args = ['args', 'args2'];
			const options = { a:1, b:2, c:3 };
			const env = sinon.stub();
			const adapter = 'adapter';
			const run = sinon.stub();
			env.registerStub = sinon.stub();
			env.run = function(name, options, callback) {
				run(name, options);
				callback(null); // no error
			};
			site.yeomanAdapter = sinon.stub().returns(adapter);
			site.args = sinon.stub().returns(args);
			site.options = sinon.stub().returns(options);
			site.yeomanEnvironment = sinon.stub().returns({ createEnv: sinon.stub().returns(env)});
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
