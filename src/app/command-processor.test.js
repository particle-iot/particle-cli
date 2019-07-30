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
const commandProcessor = require('./command-processor');


describe('command-line parsing', () => {
	describe('errors', () => {
		it('unknown command', () => {
			const args = ['a', 'b'];
			const item = {};
			const result = commandProcessor.errors.unknownCommandError(args, item);
			expect(result.data).to.be.equal(args);
			expect(result.item).to.be.equal(item);
			expect(result.message).to.be.equal('No such command \'a b\'');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(commandProcessor.errors.unknownCommandError);
		});

		it('unknown argument', () => {
			const arg = ['a'];
			const result = commandProcessor.errors.unknownArgumentError(arg);
			expect(result.data).to.be.equal(arg);
			expect(result.message).to.be.equal('Unknown argument \'a\'');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(commandProcessor.errors.unknownArgumentError);
		});

		it('unknown arguments', () => {
			const arg = ['a', 'b'];
			const result = commandProcessor.errors.unknownArgumentError(arg);
			expect(result.data).to.be.equal(arg);
			expect(result.message).to.be.equal('Unknown arguments \'a, b\'');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(commandProcessor.errors.unknownArgumentError);
		});

		const param = 'param';
		it('variadic parameter position', () => {
			const result = commandProcessor.errors.variadicParameterPositionError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Variadic parameter \'param\' must the final parameter.');
			expect(result.isApplicationError).to.be.true;
			expect(result.type).to.be.equal(commandProcessor.errors.variadicParameterPositionError);
		});

		it('optional parameter position', () => {
			const result = commandProcessor.errors.requiredParameterPositionError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Required parameter \'param\' must be placed before all optional parameters.');
			expect(result.isApplicationError).to.be.true;
			expect(result.type).to.be.equal(commandProcessor.errors.requiredParameterPositionError);
		});

		it('parameter required', () => {
			const result = commandProcessor.errors.requiredParameterError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Parameter \'param\' is required.');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(commandProcessor.errors.requiredParameterError);
		});

		it('variadic parameter required', () => {
			const result = commandProcessor.errors.variadicParameterRequiredError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Parameter \'param\' must have at least one item.');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(commandProcessor.errors.variadicParameterRequiredError);
		});

		it('unknown parameters', () => {
			const param = ['1', '2'];
			const result = commandProcessor.errors.unknownParametersError(param);
			expect(result.data).to.be.equal(param);
			expect(result.message).to.be.equal('Command parameters \'1 2\' are not expected here.');
			expect(result.isUsageError).to.be.true;
			expect(result.type).to.be.equal(commandProcessor.errors.unknownParametersError);
		});
	});

	it('returns the root cateogry for an empty command line', () => {
		const app = commandProcessor.createAppCategory();
		const argv = commandProcessor.parse(app, []);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(app);
	});

	it('returns an error for an unknown command', () => {
		const app = commandProcessor.createAppCategory();
		const unknownCommand = ['funkwomble', 'farcenugget'];
		const argv = commandProcessor.parse(app, unknownCommand);
		const error = commandProcessor.errors.unknownCommandError(unknownCommand, app);

		expect(argv.clicommand).to.equal(undefined);
		expectCLIError(argv.clierror, error);
	});

	it('returns the command when the command line matches', () => {
		const app = commandProcessor.createAppCategory();
		const one = commandProcessor.createCategory(app, 'one', 'you get');
		const cmd = commandProcessor.createCommand(one, 'chance', 'at life');
		const argv = commandProcessor.parse(app, ['one', 'chance']);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(cmd);
	});

	it('returns the category when the command line matches', () => {
		const app = commandProcessor.createAppCategory();
		const one = commandProcessor.createCategory(app, 'one', 'you get');
		const argv = commandProcessor.parse(app, ['one']);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(one);
	});

	it('returns the category when the alias matches', () => {
		const app = commandProcessor.createAppCategory();
		const one = commandProcessor.createCategory(app, 'one', { alias: 'uno' });
		const argv = commandProcessor.parse(app, ['uno']);
		expect(argv.clierror).to.be.undefined;
		expect(argv.clicommand).to.be.equal(one);
	});

	it('returns an error when the command line is not recognized', () => {
		const app = commandProcessor.createAppCategory();
		const one = commandProcessor.createCategory(app, 'one', 'you get');
		const args = ['one', 'frumpet'];
		const argv = commandProcessor.parse(app, args);
		const error = commandProcessor.errors.unknownCommandError(args, one);

		expect(argv.clicommand).to.be.equal(undefined);
		expectCLIError(argv.clierror, error);
		expect(one.path).to.eql(['one']);
	});

	it('returns an error when an unknown option is present', () => {
		const app = commandProcessor.createAppCategory();
		const argv = commandProcessor.parse(app, ['--ftlspeed']);
		const error = commandProcessor.errors.unknownArgumentError(['ftlspeed']);

		expect(argv.clicommand).to.equal(undefined);
		expectCLIError(argv.clierror, error);
	});

	it('returns an unknown command error before an unknown argument error', () => {
		const app = commandProcessor.createAppCategory();

		commandProcessor.createCategory(app, 'one', 'you get');

		const args = ['blah', '--frumpet'];
		const argv = commandProcessor.parse(app, args);
		const error = commandProcessor.errors.unknownCommandError(['blah'], app);

		expect(argv.clicommand).to.be.equal(undefined);
		expectCLIError(argv.clierror, error);
	});

	it('can accept options', () => {
		// see '.choices()` https://www.npmjs.com/package/yargs
		const app = commandProcessor.createAppCategory({ options: {
			cm: { alias: 'chundermonkey', boolean: true }
		} });

		expect(commandProcessor.parse(app, ['--cm'])).to.have.property('cm').equal(true);
		expect(commandProcessor.parse(app, ['--chundermonkey'])).to.have.property('cm').equal(true);
	});

	it('refuses options meant for other commands', () => {
		const app = commandProcessor.createAppCategory();
		const one = commandProcessor.createCommand(app, 'one', 'first', {
			options: {
				one: { alias: '1', description: '', boolean: true }
			}
		});

		commandProcessor.createCommand(app, 'two', 'second', {
			options: {
				two: { alias: '2', description: '', boolean: true }
			}
		});

		let argv, error;

		// sanity test
		argv = commandProcessor.parse(app, ['one', '--one']);

		expect(argv).to.not.have.property('clierror');
		expect(argv).to.have.property('clicommand').equal(one);
		expect(argv).to.have.property('one').equal(true);

		// the real test
		argv = commandProcessor.parse(app, ['two', '--one']);
		error = commandProcessor.errors.unknownArgumentError(['one']);

		expect(argv.clicommand).to.equal(undefined);
		expectCLIError(argv.clierror, error);
	});

	describe('parameters', () => {
		function paramsCommand(params, args) {
			const app = commandProcessor.createAppCategory();
			const cmd = commandProcessor.createCommand(app, 'cmd', 'do stuff', {
				params: params,
				options: {
					test: {
						alias: 'flag',
						boolean: true
					},
					string: {
					},
					multipleStrings: {
						nargs: 2
					},
					number: {
						number: true,
					},
					count: {
						count: true
					}
				}
			});
			const result = commandProcessor.parse(app, ['cmd'].concat(args));
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
			expect(result.params).to.deep.equal({ a:'1' });
			expect(result).to.have.property('flag').that.is.true;
		});

		it('accepts parameters after flags', () => {
			const result = paramsCommand('[a]', ['--flag', '1']);
			expect(result.params).to.deep.equal({ a:'1' });
			expect(result).to.have.property('flag').that.is.true;
		});

		it('accepts parameters before and after flags', () => {
			const result = paramsCommand('[a...]', ['1', '--flag', '2']);
			expect(result.params).to.deep.equal({ a:['1','2'] });
			expect(result).to.have.property('flag').that.is.true;
		});

		it('rejects varadic parameters not in final position', () => {
			const argv = paramsCommand('[a] [b...] [c]', ['1','2', '3']);
			const error = commandProcessor.errors.variadicParameterPositionError('b');

			expect(argv.clicommand).to.equal(undefined);
			expectCLIError(argv.clierror, error);
		});

		it('rejects omitted required varadic parameters', () => {
			const argv = paramsCommand('[a] <b...>', ['1']);
			const error = commandProcessor.errors.variadicParameterRequiredError('b');

			expect(argv.clicommand).to.equal(undefined);
			expectCLIError(argv.clierror, error);
		});

		it('rejects omitted required parameters', () => {
			const argv = paramsCommand('<a> <b>', ['1']);
			const error = commandProcessor.errors.requiredParameterError('b');

			expect(argv.clicommand).to.equal(undefined);
			expectCLIError(argv.clierror, error);
		});

		it('rejects required parameters after optional parameters', () => {
			const argv = paramsCommand('[a] <b>', ['1']);
			const error = commandProcessor.errors.requiredParameterPositionError('b');

			expect(argv.clicommand).to.equal(undefined);
			expectCLIError(argv.clierror, error);
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

		it('allows commands with multiple parameter names', () => {
			const args = paramsCommand('<a|b>', ['hey']).params;
			expect(args).to.have.property('a').equal('hey');
			expect(args).to.have.property('b').equal('hey');
		});

		it('rejects commands with unfilled required parameters', () => {
			const argv = paramsCommand('<a> <b>', ['1']);
			const error = commandProcessor.errors.requiredParameterError('b');

			expect(argv.clicommand).to.equal(undefined);
			expectCLIError(argv.clierror, error);
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
			const argv = paramsCommand('[a]', ['hey', 'there', 'you']);
			const error = commandProcessor.errors.unknownParametersError(['there', 'you']);

			expect(argv.clicommand).to.equal(undefined);
			expectCLIError(argv.clierror, error);
		});

		it('rejects parameters to non-parameterized command', () => {
			const app = commandProcessor.createAppCategory();

			commandProcessor.createCommand(app, 'cmd', 'do summat');

			const argv = commandProcessor.parse(app, ['cmd', 'stragglers', 'here']);
			const error = commandProcessor.errors.unknownParametersError(['stragglers', 'here']);

			expect(argv.clicommand).to.equal(undefined);
			expectCLIError(argv.clierror, error);
		});

		it('flags default to strings', () => {
			const result = paramsCommand('', ['--string', '42']);
			expect(result).to.have.property('string').equal('42');
		});

		it('flags require one argument by default', () => {
			expect(() => paramsCommand('', ['--string'])).to.throw(/Not enough arguments following: string/);
		});

		it('flags can require multiple arguments', () => {
			const result = paramsCommand('', ['--multipleStrings', '1', '2']);
			expect(result).to.have.property('multipleStrings').deep.equal(['1', '2']);
		});

		it('number flag get converted', () => {
			const result = paramsCommand('', ['--number', '42']);
			expect(result).to.have.property('number').equal(42);
		});

		it('count flag get counted', () => {
			const result = paramsCommand('', ['--count', '--count']);
			expect(result).to.have.property('count').equal(2);
		});

		it('keeps device ids as strings', () => {
			const result = paramsCommand('<deviceid>', ['500000000000000000000000']).params;
			expect(result).to.have.property('deviceid').equal('500000000000000000000000');
		});
	});

	describe('consoleErrorHandler', () => {

		it('calls yargs.showHelp if the error is falsey', () => {
			const yargs = { showHelp: sinon.stub() };
			const error = '';
			const console = { log: sinon.stub() };
			commandProcessor.test.consoleErrorLogger(console, yargs, false, error);
			return expect(yargs.showHelp).to.have.been.calledOnce;
		});

		it('calls yargs.showHelp if the error is a usage error', () => {
			const yargs = { showHelp: sinon.stub() };
			const error = { isUsageError: true };
			const console = { log: sinon.stub() };
			commandProcessor.test.consoleErrorLogger(console, yargs, false, error);
			return expect(yargs.showHelp).to.have.been.calledOnce;
		});

		it('logs the error message to the console', () => {
			const yargs = { };
			const message = 'we come in peace';
			const error = { message };
			const console = { log: sinon.stub() };
			commandProcessor.test.consoleErrorLogger(console, yargs, false, error);
			expect(console.log).to.have.been.calledWithMatch(message);
		});

		it('logs the error to the console when no message is given', () => {
			const yargs = { };
			const error = { bass: 'ice ice baby' };
			const console = { log: sinon.stub() };
			commandProcessor.test.consoleErrorLogger(console, yargs, false, error);
			expect(console.log).to.have.been.calledWithMatch('{ bass: \'ice ice baby\' }');
		});

		it('logs the stack trace to the console when verbose mode is enabled', () => {
			const console = { log: sinon.stub() };
			const error = new Error('hey');
			try {
				global.verboseLevel = 2;
				commandProcessor.test.consoleErrorLogger(console, undefined /*yargs*/, false, error);
			} finally {
				delete global.verboseLevel;
			}
			expect(console.log).to.have.been.calledWithMatch('hey');
			expect(console.log).to.have.been.calledWithMatch('Error: hey\n' +
				'    at Context.');
		});

		it('does not log the stack for usage errors.', () => {
			const console = { log: sinon.stub() };
			const error = { stack: '1\n2\n3', isUsageError:true, message: 'hey' };
			const yargs = { showHelp: sinon.stub() };
			commandProcessor.test.consoleErrorLogger(console, yargs, false, error);
			expect(console.log).to.have.been.calledWithMatch('hey').and.calledOnce;
		});
	});


	describe('CLICommand', () => {
		function assertCanSetDescription(desc) {
			const root = commandProcessor.createAppCategory();
			const sut = commandProcessor.createCommand(root, 'test', desc);
			expect(sut).to.have.property('description').equal(desc);
		}

		it('can have a false description to indicate a hidden command', () => {
			assertCanSetDescription(false);
		});

		it('can have a string description', () => {
			assertCanSetDescription('123');
		});
	});

	function expectCLIError(actual, expected){
		expect(actual).to.not.be.undefined;
		expect(actual).to.have.keys(Object.keys(expected));
		expect(actual.stack).to.be.a('string').with.lengthOf.above(100);
		expect(actual.isUsageError).to.equal(expected.isUsageError);
		expect(actual.message).to.equal(expected.message);
		expect(actual.type).to.eql(expected.type);
		expect(actual.data).to.eql(expected.data);
		expect(actual.item).to.eql(expected.item);
	}
});

