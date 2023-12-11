const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const nock = require('nock');
const { expect, sinon } = require('../../test/setup');
const LogicFunctionCommands = require('./logic-function');
const { PATH_FIXTURES_LOGIC_FUNCTIONS, PATH_TMP_DIR } = require('../../test/lib/env');
const templateProcessor = require('../lib/template-processor');
const { slugify } = require('../lib/utilities');

describe('LogicFunctionCommands', () => {
	let logicFunctionCommands;
	let originalUi = new LogicFunctionCommands().ui;
	let logicFunc1 = fs.readFileSync(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'logicFunc1.json'), 'utf-8');
	logicFunc1 = JSON.parse(logicFunc1);
	let logicFunc2 = fs.readFileSync(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'logicFunc2.json'), 'utf-8');
	logicFunc2 = JSON.parse(logicFunc2);

	beforeEach(async () => {
		logicFunctionCommands = new LogicFunctionCommands();
		logicFunctionCommands.ui = {
			stdout: {
				write: sinon.stub()
			},
			stderr: {
				write: sinon.stub()
			},
			prompt: sinon.stub(),
			chalk: {
				bold: sinon.stub(),
				cyanBright: sinon.stub(),
				yellow: sinon.stub(),
				grey: sinon.stub(),
				red: sinon.stub()
			},
		};
	});

	afterEach(async () => {
		sinon.restore();
		logicFunctionCommands.ui = originalUi;
		// remove tmp dir
		fs.emptyDirSync(PATH_TMP_DIR);

	});

	describe('_setOrg', async() => {
		it('sets the organization member', () => {
			const orgBeforeSetting = logicFunctionCommands.org;

			logicFunctionCommands._setOrg('myOrg');

			const orgAfterSetting = logicFunctionCommands.org;
			expect(orgBeforeSetting).to.be.null;
			expect(orgAfterSetting).to.eql('myOrg');
		});
	});

	describe('_getLogicFunctionList', () => {
		it('lists logic functions in Sandbox', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, logicFunc1);
			const expectedResp = logicFunc1.logic_functions;

			await logicFunctionCommands._getLogicFunctionList({});

			expect(logicFunctionCommands.logicFuncList).to.eql(expectedResp);
		});

		it('lists logic functions in an org', async () => {
			nock('https://api.particle.io/v1/orgs/particle')
				.intercept('/logic/functions', 'GET')
				.reply(200, logicFunc2);
			const expectedResp = logicFunc2.logic_functions;
			logicFunctionCommands.org = 'particle';

			await logicFunctionCommands._getLogicFunctionList({ org: 'particle' });

			expect(logicFunctionCommands.logicFuncList).to.eql(expectedResp);
		});

		it('lists empty if no logic functions are found', async () => {
			nock('https://api.particle.io/v1/orgs/particle')
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: [] });
			const expectedResp = [];
			logicFunctionCommands.org = 'particle';

			await logicFunctionCommands._getLogicFunctionList({ org: 'particle' });

			expect(logicFunctionCommands.logicFuncList).to.eql(expectedResp);
		});

		it('throws an error if API is not accessible', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(500, { error: 'Internal Server Error' });

			let error;
			try {
				await logicFunctionCommands._getLogicFunctionList({});
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Error listing logic functions: Internal Server Error');
		});

		it('throws an error if org is not found', async () => {
			nock('https://api.particle.io/v1/orgs/particle')
				.intercept('/logic/functions', 'GET')
				.reply(404, { error: 'Organization Not Found' });
			logicFunctionCommands.org = 'particle';

			let error;
			try {
				await logicFunctionCommands._getLogicFunctionList({ org: 'particle' });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Error listing logic functions: Organization Not Found');
		});
	});

	describe('_getLogicFunctionData', async() => {
		it('gets the logic function json', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);
			const expectedResp = { logic_function: logicFunc1.logic_functions[0] };

			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'GET')
				.reply(200, { logic_function: logicFunc1.logic_functions[0] });

			const res = await logicFunctionCommands._getLogicFunctionData('0021e8f4-64ee-416d-83f3-898aa909fb1b');

			expect(res).to.eql(expectedResp);
		});

		it('returns error if logic-function is not found', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);

			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'GET')
				.reply(404, { });

			let error;
			try {
				await logicFunctionCommands._getLogicFunctionData('0021e8f4-64ee-416d-83f3-898aa909fb1b');
			} catch (_e) {
				error = _e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Error getting logic function: HTTP error 404 from https://api.particle.io/v1/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b');
		});
	});

	describe('_generateFiles', async() => {
		it ('generates files from the data given', async() => {
			const data = { logic_function : logicFunc1.logic_functions[0] };
			const logicFunctionCode = data.logic_function.source.code;
			const logicFunctionConfigData = data.logic_function;
			delete logicFunctionConfigData.source;
			sinon.stub(logicFunctionCommands, '_validatePaths').resolves(true);
			const name = 'LF1';
			const slugName = slugify(name);

			const { dirPath, jsonPath, jsPath } = await logicFunctionCommands._generateFiles({ logicFunctionConfigData, logicFunctionCode, name: 'LF1' });

			expect(dirPath).to.eql(path.join(process.cwd(), slugName));
			expect(jsonPath).to.eql(path.join(process.cwd(), slugName, `${slugName}.logic.json`));
			expect(jsPath).to.eql(path.join(process.cwd(), slugName, `${slugName}.js`));

			await fs.remove(dirPath);
		});
	});

	describe('_getLocalLFPathNames', async() => {
		it('returns local file paths where the LF should be saved', () => {
			const slugName = slugify('LF1');
			const { dirPath, jsonPath, jsPath } = logicFunctionCommands._getLocalLFPathNames('LF1');

			expect(dirPath).to.eql(path.join(process.cwd(), slugName));
			expect(jsonPath).to.eql(path.join(process.cwd(), slugName, `${slugName}.logic.json`));
			expect(jsPath).to.eql(path.join(process.cwd(), slugName, `${slugName}.js`));
		});
	});

	describe('create', () => {
		it('creates a logic function locally for Sandbox account', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: [] });
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'logic func 1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });
			const filePaths = await logicFunctionCommands.create({
				params: { filepath: PATH_TMP_DIR }
			});
			expect(filePaths.length).to.equal(4);
			const expectedFiles = [
				path.join('logic-func-1', 'logic-func-1.js'),
				path.join('logic-func-1', 'logic-func-1.logic.json'),
				path.join('logic-func-1', '@types', 'particle_core.d.ts'),
				path.join('logic-func-1', '@types', 'particle_encoding.d.ts')
			];
			for (const expectedFile of expectedFiles) {
				const includesExpected = filePaths.some(value => value.includes(expectedFile));
				expect(includesExpected, `File path "${expectedFile}" does not include expected values`).to.be.true;
			}
		});

		it('shows warning if a logic function cannot be looked up in the cloud', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);

			logicFunctionCommands.logicFuncList = logicFunctions;

			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'logicFunc1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });
			await logicFunctionCommands.create({
				params: { filepath: PATH_TMP_DIR }
			});
			expect(logicFunctionCommands.ui.chalk.yellow.callCount).to.equal(2);
		});

		it('ask to overwrite if files already exist', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: [] });
			sinon.stub(templateProcessor, 'hasTemplateFiles').resolves(true);
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'logicFunc1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });
			logicFunctionCommands.ui.prompt.onCall(2).resolves({ overwrite: true });
			await logicFunctionCommands.create({
				params: { filepath: PATH_TMP_DIR }
			});
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(3);
			expect(logicFunctionCommands.ui.prompt.thirdCall.args[0][0].message).to.contain('We found existing files in');
		});

		it('throws an error if logic function already exists', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, logicFunc1);
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'LF1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });
			let error;
			try {
				await logicFunctionCommands.create({
					params: { filepath: PATH_TMP_DIR }
				});
			} catch (e) {
				error = e;
			}
			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Logic Function LF1 already exists in your Sandbox. Use a new name for your Logic Function.');
		});

	});

	describe('execute', () => {
		it('executes a logic function with user provided data', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/execute', 'POST')
				.reply(200, { result: { status: 'Success', logs: [] } });
			await logicFunctionCommands.execute({
				params: { filepath: path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf1_proj') },
				data: { foo: 'bar' }
			});
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(4);
			expect(logicFunctionCommands.ui.chalk.bold.callCount).to.equal(1);
			expect(logicFunctionCommands.ui.chalk.bold.firstCall.args[0]).to.equal('code.js'); // file name
			expect(logicFunctionCommands.ui.chalk.cyanBright.callCount).to.equal(2);
			expect(logicFunctionCommands.ui.chalk.cyanBright.firstCall.args[0]).to.equal('Success');
			expect(logicFunctionCommands.ui.chalk.cyanBright.secondCall.args[0]).to.equal(`No errors during Execution.${os.EOL}`);
		});
		it('executes a logic function with user provided data from file', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/execute', 'POST')
				.reply(200, { result: { status: 'Success', logs: [] } });
			await logicFunctionCommands.execute({
				params: { filepath: path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf1_proj') },
				dataPath: path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf1_proj', 'sample', 'data.json')
			});
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(4);
			expect(logicFunctionCommands.ui.chalk.bold.callCount).to.equal(1);
			expect(logicFunctionCommands.ui.chalk.bold.firstCall.args[0]).to.equal('code.js'); // file name
			expect(logicFunctionCommands.ui.chalk.cyanBright.callCount).to.equal(2);
			expect(logicFunctionCommands.ui.chalk.cyanBright.firstCall.args[0]).to.equal('Success');
			expect(logicFunctionCommands.ui.chalk.cyanBright.secondCall.args[0]).to.equal(`No errors during Execution.${os.EOL}`);
		});
		it('executes a logic function with user provided data from file and shows error', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/execute', 'POST')
				.reply(200, { result: { status: 'Exception', logs: [], err: 'Error message' } });
			await logicFunctionCommands.execute({
				params: { filepath: path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf1_proj') },
				dataPath: path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf1_proj', 'sample', 'data.json')
			});
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(5);
			expect(logicFunctionCommands.ui.chalk.bold.firstCall.args[0]).to.equal('code.js'); // file name
			expect(logicFunctionCommands.ui.stdout.write.lastCall.args[0]).to.equal(`Error message${os.EOL}`);
		});
		it('prompts if found multiple files', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/execute', 'POST')
				.reply(200, { result: { status: 'Success', logs: [] } });
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ file: 'code.js' });
			await logicFunctionCommands.execute({
				params: { filepath: path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'lf2_proj') },
				data: { foo: 'bar' }
			});
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(1);
			expect(logicFunctionCommands.ui.prompt.firstCall.args[0][0].choices[0].name).to.equal('code.js');
			expect(logicFunctionCommands.ui.prompt.firstCall.args[0][0].choices[1].name).to.equal('code2.js');
		});
	});

	describe('_validatePaths', () => {
		afterEach(() => {
			sinon.restore();
		});

		it('returns if paths do not exist', async () => {
			sinon.stub(fs, 'pathExists').resolves(false);

			const paths = ['dir/', 'dir/path/to/file'];

			const res = await logicFunctionCommands._validatePaths({ dirPath: paths[0], jsonPath: paths[1], _exit: false });

			expect(res).to.eql(undefined);

		});

		it('returns if all paths exist and not overwriting', async () => {
			const exitStub = sinon.stub();
			sinon.stub(fs, 'pathExists').resolves(true);
			sinon.stub(logicFunctionCommands, '_promptOverwrite').resolves(false);
			const paths = ['dir/', 'dir/path/to/file'];

			await logicFunctionCommands._validatePaths({ dirPath: paths[0], jsonPath: paths[1], _exit: exitStub });

			expect(logicFunctionCommands._promptOverwrite.callCount).to.eql(1);
			expect(exitStub.callCount).to.eql(1);
		});

		it('prompts if any path exists and overwriting', async () => {
			sinon.stub(fs, 'pathExists').resolves(true);
			sinon.stub(logicFunctionCommands, '_promptOverwrite').resolves(true);
			const paths = ['dir/', 'dir/path/to/file'];

			const res = await logicFunctionCommands._validatePaths({ paths });

			expect(res).to.eql(undefined);

		});
	});

	describe('_promptOverwrite', () => {
		it('should return true if user chooses not to overwrite', async () => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ overwrite: false });

			const res = await logicFunctionCommands._promptOverwrite({
				pathToCheck: 'somePath',
				message: 'someMessage'
			});

			expect(res).to.be.false;
		});

		it('should return false user chooses to overwrite', async () => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ overwrite: true });

			const res = await logicFunctionCommands._promptOverwrite({
				pathToCheck: 'somePath',
				message: 'someMessage'
			});

			expect(res).to.be.true;
		});
	});

	describe('_getIdFromName', () => {
		it('returns id from LF name', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);

			const res = await logicFunctionCommands._getIdFromName('LF1', logicFunctions);

			expect(res).to.equal('0021e8f4-64ee-416d-83f3-898aa909fb1b');
		});

		it('returns an error if id is not found', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);

			let error;
			try {
				await logicFunctionCommands._getIdFromName('LF3', logicFunctions);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Unable to get logic function id from name');
		});
	});

	describe('_getNameFromId', () => {
		it('returns name if found', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);

			const res = await logicFunctionCommands._getNameFromId('0021e8f4-64ee-416d-83f3-898aa909fb1b', logicFunctions);

			expect(res).to.equal('LF1');
		});

		it('returns an error if name is not found', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);

			let error;
			try {
				await logicFunctionCommands._getIdFromName('0021e8f4-64ee-416d-83f3-898aa909fb1c', logicFunctions);
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Unable to get logic function id from name');
		});
	});

	describe('_getLogicFunctionIdAndName', () => {
		let logicFunctions = [];
		logicFunctions.push(logicFunc1.logic_functions[0]);
		logicFunctions.push(logicFunc2.logic_functions[0]);

		beforeEach(async () => {
			logicFunctionCommands.logicFuncList = logicFunctions;
		});

		it('returns id and name if both are provided', async () => {
			const { name, id } = await logicFunctionCommands._getLogicFunctionIdAndName('LF1', '0021e8f4-64ee-416d-83f3-898aa909fb1b');

			expect(name).to.eql('LF1');
			expect(id).to.eql('0021e8f4-64ee-416d-83f3-898aa909fb1b');
		});

		it('returns name and id if name is provided', async () => {
			const { name, id } = await logicFunctionCommands._getLogicFunctionIdAndName('LF1', undefined);

			expect(name).to.eql('LF1');
			expect(id).to.eql('0021e8f4-64ee-416d-83f3-898aa909fb1b');
		});

		it('returns name and id if id is provided', async () => {
			const { name, id } = await logicFunctionCommands._getLogicFunctionIdAndName(undefined, '0021e8f4-64ee-416d-83f3-898aa909fb1b');

			expect(name).to.eql('LF1');
			expect(id).to.eql('0021e8f4-64ee-416d-83f3-898aa909fb1b');
		});

		it('error if list is unable to be fetched', async () => {
			logicFunctionCommands.logicFuncList = [];

			let error;
			try {
				await logicFunctionCommands._getLogicFunctionIdAndName(undefined, undefined);
			} catch (_e) {
				error = _e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('No logic functions found');
		});

		it('returns error if id is not found', async () => {
			let error;
			try {
				await logicFunctionCommands._getLogicFunctionIdAndName('LF3', undefined);
			} catch (_e) {
				error = _e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Unable to get logic function id from name');
		});

		it('returns error if name is not found', async () => {
			let error;
			try {
				await logicFunctionCommands._getLogicFunctionIdAndName(undefined, '0021e8f4-64ee-416d-83f3-898aa909fb1c');
			} catch (_e) {
				error = _e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Unable to get logic function name from id');
		});

	});

	describe('_selectLogicFunction', () => {
		it('selects logic function from a list', async () => {
			const logicFunctions = ['logicFunc1', 'logicFunc2'];
			const selectedLF = 'logicFunc2';
			const promptStub = sinon.stub(logicFunctionCommands, '_prompt');
			promptStub.resolves({ logic_function: selectedLF });

			const res = await logicFunctionCommands._selectLogicFunction(logicFunctions);

			expect(res).to.eql(selectedLF);
			sinon.assert.calledOnceWithExactly(promptStub, {
				type: 'list',
				name: 'logic_function',
				message: 'Which logic function would you like to download?',
				choices: logicFunctions,
				nonInteractiveError: 'Provide name for the logic function',
			});
		});

		it('returns error if list is empty', async () => {
			const logicFunctions = [];

			let error;
			try {
				await logicFunctionCommands._selectLogicFunction(logicFunctions);
			} catch (_e) {
				error = _e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.eql('No logic functions found');
		});
	});

	describe('_validateLFName', () => {
		it('returns true if a logic function with that name already deployed', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);

			logicFunctionCommands.logicFuncList = logicFunctions;

			const res = await logicFunctionCommands._validateLFName({ name: 'LF1' });

			expect(res).to.be.true;

		});

		it('returns if logic function is not already deployed', async () => {
			let logicFunctions = [];
			logicFunctions.push(logicFunc1.logic_functions[0]);
			logicFunctions.push(logicFunc2.logic_functions[0]);

			logicFunctionCommands.logicFuncList = logicFunctions;

			const res = await logicFunctionCommands._validateLFName({ name: 'LF3' });

			expect(res).to.be.false;
		});
	});

	describe('delete', () => {
		let logicFunctions = [];
		logicFunctions.push(logicFunc1.logic_functions[0]);
		logicFunctions.push(logicFunc2.logic_functions[0]);

		beforeEach(() => {
			logicFunctionCommands.logicFuncList = logicFunctions;
		});

		afterEach(() => {
			nock.cleanAll();
		});

		it('checks for confirmation before deleting', async() => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ delete: true });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: logicFunctions });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'DELETE')
				.reply(204, { });

			await logicFunctionCommands.delete({ name: 'LF1' });

			expect(logicFunctionCommands._prompt).to.have.been.calledOnce;
		});

		it('returns without throwing an error if success', async() => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ delete: true });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: logicFunctions });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'DELETE')
				.reply(204, { });

			let error;
			try {
				await logicFunctionCommands.delete({ name: 'LF1' });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.undefined;
		});

		it('process exits if user does not want to delete during confirmation', async() => {
			logicFunctionCommands.logicFuncList = logicFunctions;
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ delete: false });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: logicFunctions });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'DELETE')
				.reply(204, { });

			await logicFunctionCommands.delete({ name: 'LF1' });

			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(1);
			expect(logicFunctionCommands.ui.stdout.write.lastCall.lastArg).to.equal('Aborted.\n');
		});

		it('throws an error if deletion fails', async() => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ delete: true });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: logicFunctions });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'DELETE')
				.reply(404, {});

			let error;
			try {
				await logicFunctionCommands.delete({ name: 'LF1' });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.contain('Error deleting Logic Function LF1');
		});
	});

	describe('disable', () => {
		let logicFunctions = [];
		logicFunctions.push(logicFunc1.logic_functions[0]);
		logicFunctions.push(logicFunc2.logic_functions[0]);
		const logicFunc1Data = logicFunc1.logic_functions[0];
		logicFunc1Data.enabled = false;

		beforeEach(() => {
			logicFunctionCommands.logicFuncList = logicFunctions;
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'GET')
				.reply(200, { logic_function: logicFunc1.logic_functions[0] });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'GET')
				.reply(200, { logic_function: logicFunc1.logic_functions[0] });
		});

		afterEach(() => {
			fs.rmSync('lf1', { recursive: true, force: true });
		});

		it('disables a logic function with name', async() => {
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(201, { logic_function: logicFunc1Data });
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ overwrite: true });
			sinon.stub(logicFunctionCommands, '_printDisableOutput').resolves({ });
			sinon.stub(logicFunctionCommands, 'get').resolves({ });

			await logicFunctionCommands.disable({ name: 'LF1' });

			expect(logicFunctionCommands._printDisableOutput).to.have.been.calledOnce;
			expect(logicFunctionCommands.get).to.have.been.calledOnce;
		});

		it('disables a logic function with id', async() => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ overwrite: true });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(201, { logic_function: logicFunc1Data });
			sinon.stub(logicFunctionCommands, '_printDisableOutput').resolves({ });
			sinon.stub(logicFunctionCommands, 'get').resolves({ });

			await logicFunctionCommands.disable({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b' });

			expect(logicFunctionCommands._printDisableOutput).to.have.been.calledOnce;
			expect(logicFunctionCommands.get).to.have.been.calledOnce;
		});

		it('fails to disable a logic function', async() => {
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(404, { error: 'Error' });
			sinon.stub(logicFunctionCommands, '_printDisableOutput').resolves({ });

			let error;
			try {
				await logicFunctionCommands.disable({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b' });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.contain('Error disabling Logic Function LF1');
			expect(logicFunctionCommands._printDisableOutput).to.not.have.been.called;
		});
	});
});
