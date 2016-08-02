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

import {expect, sinon} from '../test-setup';

import * as cli from '../../src/app/nested-yargs'

describe('command-line parsing', () => {

	describe('errors', () => {
		it('unknown command', () => {
			const args = ['a', 'b'];
			const item = {};
			const result = cli.errors.unknownCommandError(args, item);
			expect(result.data).to.be.equal(args);
			expect(result.item).to.be.equal(item);
			expect(result.message).to.be.equal('No such command \'a b\'');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(cli.errors.unknownCommandError);
		});

		it('unknown argument', () => {
			const arg = ['a'];
			const result = cli.errors.unknownArgumentError(arg);
			expect(result.data).to.be.equal(arg);
			expect(result.message).to.be.equal('Unknown argument \'a\'');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(cli.errors.unknownArgumentError);
		});

		it('unknown arguments', () => {
			const arg = ['a', 'b'];
			const result = cli.errors.unknownArgumentError(arg);
			expect(result.data).to.be.equal(arg);
			expect(result.message).to.be.equal('Unknown arguments \'a, b\'');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(cli.errors.unknownArgumentError);
		});

		const param = 'param';
		it('variadic parameter position', () => {
			const result = cli.errors.variadicParameterPositionError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Variadic parameter \'param\' must the final parameter.');
			expect(result.isApplicationError).to.be.true;
			expect(result.type).to.be.equal(cli.errors.variadicParameterPositionError);
		});

		it('optional parameter position', () => {
			const result = cli.errors.requiredParameterPositionError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Required parameter \'param\' must be placed before all optional parameters.');
			expect(result.isApplicationError).to.be.true;
			expect(result.type).to.be.equal(cli.errors.requiredParameterPositionError);
		});

		it('parameter required', () => {
			const result = cli.errors.requiredParameterError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Parameter \'param\' is required.');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(cli.errors.requiredParameterError);
		});

		it('variadic parameter required', () => {
			const result = cli.errors.variadicParameterRequiredError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Parameter \'param\' must have at least one item.');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(cli.errors.variadicParameterRequiredError);
		});

		it('unknown parameters', () => {
			const param = ['1', '2'];
			const result = cli.errors.unknownParametersError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Command parameters \'1 2\' are not expected here.');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(cli.errors.unknownParametersError);
		});
	});

	it('returns the root cateogry for an empty command line', () => {
		const app = cli.createAppCategory();
		const argv = cli.parse(app, []);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(app);
	});

	it('returns an error for an unknown command', () => {
		const app = cli.createAppCategory();
		const unknown_command = ['funkwomble', 'farcenugget'];
		const argv = cli.parse(app, unknown_command);
		expect(argv.clicommand).to.be.undefined;
		expect(argv.clierror).to.not.be.undefined;
		expect(argv.clierror).to.be.deep.equal(cli.errors.unknownCommandError(unknown_command, app));
	});

	it('returns the command when the command line matches', () => {
		const app = cli.createAppCategory();
		const one = cli.createCategory(app, 'one', 'you get');
		const cmd = cli.createCommand(one, 'chance', 'at life');
		const argv = cli.parse(app, ['one', 'chance']);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(cmd);
	});

	it('returns the category when the command line matches', () => {
		const app = cli.createAppCategory();
		const one = cli.createCategory(app, 'one', 'you get');
		const argv = cli.parse(app, ['one']);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(one);
	});

	it('returns the category when the alias matches', () => {
		const app = cli.createAppCategory();
		const one = cli.createCategory(app, 'one', { alias: 'uno' });
		const argv = cli.parse(app, ['uno']);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(one);
	});

	it('returns an error when the command line is not recognized', () => {
		const app = cli.createAppCategory();
		const one = cli.createCategory(app, 'one', 'you get');
		const args = ['one', 'frumpet'];
		const argv = cli.parse(app, args);
		expect(argv.clicommand).to.be.equal(undefined);
		expect(argv.clierror).to.be.deep.equal(cli.errors.unknownCommandError(args, one));
		expect(one.path)
	});

	it('returns an error when an unknown option is present', () => {
		const app = cli.createAppCategory();
		const args = ['--ftlspeed'];
		const argv = cli.parse(app, args);
		expect(argv.clicommand).to.be.equal(undefined);
		expect(argv.clierror).to.be.deep.equal(cli.errors.unknownArgumentError(['ftlspeed']));
	});

	it('can accept options', () => {
		// see '.choices()` https://www.npmjs.com/package/yargs
		const app = cli.createAppCategory({ options: {
			cm: { alias: 'chundermonkey' }
		}});

		expect(cli.parse(app, ['--cm'])).to.have.property('cm').equal(true);
		expect(cli.parse(app, ['--chundermonkey'])).to.have.property('cm').equal(true);
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
		expect(cli.parse(app, ['one', '--one'])).to.not.have.property('clierror');
		expect(cli.parse(app, ['one', '--one'])).to.have.property('clicommand').equal(one);
		expect(cli.parse(app, ['one', '--one'])).to.have.property('one').equal(true);

		// the real test
		expect(cli.parse(app, ['two', '--one'])).to.not.have.property('clicommand');
		expect(cli.parse(app, ['two', '--one'])).to.have.property('clierror').deep.equal(
			cli.errors.unknownArgumentError(['one']));
	});

	describe('parameters', () => {
		function paramsCommand(params, args) {
			const app = cli.createAppCategory();
			const cmd = cli.createCommand(app, 'cmd', 'do stuff', {
				params: params,
				options: {
					test: {
						alias: 'flag',
						boolean: true
					}
				}
			});
			const result = cli.parse(app, ['cmd'].concat(args));
			// only one of them set
			expect(result.clicommand || result.clierror).to.be.ok;
			expect(result.clicommand && result.clierror).to.be.not.ok;
			if (result.clicommand) {
				expect(result.clicommand).to.be.equal(cmd);
			}
			return result;
		}

		it('accepts parameters before flags', () => {
			const result = paramsCommand('[a]', ['1', '--flag']);
			expect(result.params).to.deep.equal({a:'1'});
			expect(result).to.have.property('flag').that.is.true;
		});

		it('accepts parameters after flags', () => {
			const result = paramsCommand('[a]', ['--flag', '1']);
			expect(result.params).to.deep.equal({a:'1'});
			expect(result).to.have.property('flag').that.is.true;
		});

		it('accepts parameters before and after flags', () => {
			const result = paramsCommand('[a...]', ['1', '--flag', '2']);
			expect(result.params).to.deep.equal({a:['1','2']});
			expect(result).to.have.property('flag').that.is.true;
		});

		it("rejects varadic parameters not in final position", () => {
			expect(paramsCommand('[a] [b...] [c]', ['1','2', '3']).clierror).
			to.deep.equal(cli.errors.variadicParameterPositionError('b'));
		});

		it("rejects omitted required varadic parameters", () => {
			expect(paramsCommand('[a] <b...>', ['1']).clierror).
			to.deep.equal(cli.errors.variadicParameterRequiredError('b'));
		});

		it("rejects omitted required parameters", () => {
			expect(paramsCommand('<a> <b>', ['1']).clierror).
			to.deep.equal(cli.errors.requiredParameterError('b'));
		});

		it("rejects required parameters after optional parameters", () => {
			expect(paramsCommand('[a] <b>', ['1']).clierror).
			to.deep.equal(cli.errors.requiredParameterPositionError('b'));
		});

		it('allows commands with unfilled optional parameters', () => {
			expect(paramsCommand('[a]', []).params).to.have.property('a').equal(undefined);
		});

		it('allows commands with filled optional parameters', () => {
			expect(paramsCommand('[a]', ['hey']).params).to.have.property('a').equal('hey');
		});

		it('allows commands with filled required parameters', () => {
			expect(paramsCommand('<a>', ['hey']).params).to.have.property('a').equal('hey');
		});

		it('rejects commands with unfilled required parameters', () => {
			expect(paramsCommand('<a> <b>', ['1'])).to.have.property('clierror')
				.deep.equal(cli.errors.requiredParameterError('b'));
		});

		it('allows commands with mixed optional and required parameters', () => {
			const result = paramsCommand('<a> [b] [c]', ['1', '2']).params;
			expect(result).to.have.property('a').equal('1');
			expect(result).to.have.property('b').equal('2');
			expect(result).to.have.property('c').equal(undefined);
		});

		it('allows commands with mixed optional and required parameters and optional unfilled variadic', () => {
			const result = paramsCommand('<a> [b] [c...]', ['1', '2']).params;
			expect(result).to.have.property('a').equal('1');
			expect(result).to.have.property('b').equal('2');
			expect(result).to.have.property('c').deep.equal([]);
		});

		it('allows commands with mixed optional and required parameters and optional filled variadic', () => {
			const result = paramsCommand('<a> [b] [c...]', ['1', '2', '3', '4']).params;
			expect(result).to.have.property('a').equal('1');
			expect(result).to.have.property('b').equal('2');
			expect(result).to.have.property('c').deep.equal(['3','4']);
		});

		it('rejects parameterized command with surplus arguments', () => {
			expect(paramsCommand('[a]', ['hey', 'there', 'you'])).to.have.property('clierror')
				.deep.equal(cli.errors.unknownParametersError(['there', 'you']));
		});

		it('rejects parameters to non-parameterized command', () => {
			const app = cli.createAppCategory();
			const cmd = cli.createCommand(app, 'cmd', 'do summat');

			expect(cli.parse(app, ['cmd', 'stragglers', 'here'])).to.have.property('clierror')
				.deep.equal(cli.errors.unknownParametersError(['stragglers', 'here']));
		});
	});

	describe('consoleErrorHandler', () => {

		it('calls yargs.showHelp if the error is falsey', () => {
			const yargs = { showHelp: sinon.stub() };
			const error = '';
			const console = { log: sinon.stub() };
			cli.test.consoleErrorLogger(console, yargs, false, error);
			return expect(yargs.showHelp).to.have.been.calledOnce;
		});

		it('calls yargs.showHelp if the error is a usage error', () => {
			const yargs = { showHelp: sinon.stub() };
			const error = { isUsageError: true };
			const console = { log: sinon.stub() };
			cli.test.consoleErrorLogger(console, yargs, false, error);
			return expect(yargs.showHelp).to.have.been.calledOnce;
		});

		it('logs the error message to the console', () => {
			const yargs = { };
			const message = 'we come in peace';
			const error = { message };
			const console = { log: sinon.stub() };
			cli.test.consoleErrorLogger(console, yargs, false, error);
			expect(console.log).to.have.been.calledWithMatch(message);
		});

		it('logs the error to the console when no message is given', () => {
			const yargs = { };
			const error = { bass: 'ice ice baby' };
			const console = { log: sinon.stub() };
			cli.test.consoleErrorLogger(console, yargs, false, error);
			expect(console.log).to.have.been.calledWithMatch('{ bass: \'ice ice baby\' }');
		});

		it('splits the stack string and logs that to the console', () => {
			const console = { log: sinon.stub() };
			const error = { stack: '1\n2\n3' };
			cli.test.consoleErrorLogger(console, undefined /*yargs*/, false, error);
			expect(console.log).to.have.been.calledWith(error, ['1', '2', '3']);
		});

		it('does not log the stack for usage errors.', () => {
			const console = { log: sinon.stub() };
			const error = { stack: '1\n2\n3', isUsageError:true, message: 'hey' };
			const yargs = { showHelp: sinon.stub() };
			cli.test.consoleErrorLogger(console,  yargs, false, error);
			expect(console.log).to.have.been.calledWithMatch('hey').and.calledOnce;
		});


	});

});

