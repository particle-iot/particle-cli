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

import * as cli from '../src/cli/nested-yargs'

describe('command-line parsing', () => {

	describe('errors', () => {
		it('unknown command', () => {
			const args = ['a', 'b'];
			const result = cli.unknownCommandError(args);
			expect(result.data).to.be.equal(args);
			expect(result.msg).to.be.equal('No such command \'a b\'');
		});

		it('unknown argument', () => {
			const arg = ['a'];
			const result = cli.unknownArgumentError(arg);
			expect(result.data).to.be.equal(arg);
			expect(result.msg).to.be.equal('Unknown argument \'a\'');
		});

		it('unknown arguments', () => {
			const arg = ['a', 'b'];
			const result = cli.unknownArgumentError(arg);
			expect(result.data).to.be.equal(arg);
			expect(result.msg).to.be.equal('Unknown arguments \'a, b\'');
		});
	});
	
	it('returns the root cateogry for an empty command line', () => {
		const app = cli.createAppCategory();
		const argv = app.parse([]);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(app);
	});

	it('returns an error for an unknown command', () => {
		const app = cli.createAppCategory();
		const unknown_command = ['funkwomble', 'farcenugget'];
		const argv = app.parse(unknown_command);
		expect(argv.clicommand).to.be.undefined;
		expect(argv.clierror).to.not.be.undefined;
		expect(argv.clierror).to.be.deep.equal(cli.unknownCommandError(unknown_command));
	});

	it('returns the command when the command line matches', () => {
		const app = cli.createAppCategory();
		const one = cli.createCategory(app, 'one', 'you get');
		const cmd = cli.createCommand(one, 'chance', 'at life');
		const argv = app.parse(['one', 'chance']);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(cmd);
	});

	it('returns an error when the command line is not recognized', () => {
		const app = cli.createAppCategory();
		const one = cli.createCategory(app, 'one', 'you get');
		const args = ['one', 'frumpet'];
		const argv = app.parse(args);
		expect(argv.clicommand).to.be.equal(undefined);
		expect(argv.clierror).to.be.deep.equal(cli.unknownCommandError(args));
	});

	it('returns an error when an unknown option is present', () => {
		const app = cli.createAppCategory();
		const args = ['--ftlspeed'];
		const argv = app.parse(args);
		expect(argv.clicommand).to.be.equal(undefined);
		expect(argv.clierror).to.be.deep.equal(cli.unknownArgumentError(['ftlspeed']));
	});

	it('can accept options', () => {
		// see '.choices()` https://www.npmjs.com/package/yargs
		const app = cli.createAppCategory({ options: {
			cm: { alias: 'chundermonkey' }
		}});

		expect(app.parse(['--cm'])).to.have.property('cm').equal(true);
		expect(app.parse(['--chundermonkey'])).to.have.property('cm').equal(true);
	});

	it('refuses options meant for other commands', () => {
		const app = cli.createAppCategory();
		const one = cli.createCommand(app, 'one', 'first', { options: {
			one: { alias: '1', description: ''}
		}});
		const two = cli.createCommand(app, 'two', 'second', { options: {
			two: { alias: '2', description: ''}
		}});

		// sanity test
		expect(app.parse(['one', '--one'])).to.not.have.property('clierror');
		expect(app.parse(['one', '--one'])).to.have.property('clicommand').equal(one);
		expect(app.parse(['one', '--one'])).to.have.property('one').equal(true);

		// the real test
		expect(app.parse(['two', '--one'])).to.not.have.property('clicommand');
		expect(app.parse(['two', '--one'])).to.have.property('clierror').deep.equal(cli.unknownArgumentError(['one']));
	});

	
});

