const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const nock = require('nock');
const { expect, sinon } = require('../../test/setup');
const LogicFunctionCommands = require('./logic-function');
const { PATH_FIXTURES_LOGIC_FUNCTIONS, PATH_TMP_DIR } = require('../../test/lib/env');
const { slugify } = require('../lib/utilities');
const LogicFunction = require('../lib/logic-function');

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
				bold: sinon.stub().callsFake((str) => str),
				cyanBright: sinon.stub().callsFake((str) => str),
				cyan: sinon.stub().callsFake((str) => str),
				yellow: sinon.stub().callsFake((str) => str),
				grey: sinon.stub().callsFake((str) => str),
				red: sinon.stub().callsFake((str) => str),
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

	describe('list', () => {
		beforeEach(() => {
			logicFunc1.logic_functions.forEach((lf) => {
				lf.triggers = lf.logic_triggers;
			});
		});

		it('lists logic functions in Sandbox account', async () => {

			const logicListStub = sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.list({});
			expect(logicListStub.calledWith({ api: logicFunctionCommands.api, org: undefined })).to.be.true;
			expect(logicListStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.firstCall.args[0]).to.equal(`Logic Functions deployed in your Sandbox:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write.secondCall.args[0]).to.equal(`- LF1 (disabled)${os.EOL}`);
		});

		it('lists logic functions in an org', async () => {
			const logicListStub = sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.list({ org: 'particle' });
			expect(logicListStub.calledWith({ api: logicFunctionCommands.api, org: 'particle' })).to.be.true;
			expect(logicListStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.firstCall.args[0]).to.equal(`Logic Functions deployed in particle:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write.secondCall.args[0]).to.equal(`- LF1 (disabled)${os.EOL}`);
		});

		it('shows help if no logic functions are found', async () => {
			const logicListStub = sinon.stub(LogicFunction, 'listFromCloud').resolves([]);
			await logicFunctionCommands.list({});
			expect(logicListStub.calledWith({ api: logicFunctionCommands.api, org: undefined })).to.be.true;
			expect(logicListStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.firstCall.args[0]).to.equal(`No Logic Functions deployed in your Sandbox.${os.EOL}`);
		});

		it('shows help if no logic functions are found', async () => {
			const logicListStub = sinon.stub(LogicFunction, 'listFromCloud').resolves([]);
			await logicFunctionCommands.list({ api: logicFunctionCommands.api, org: 'particle' });
			expect(logicListStub.calledWith({ api: logicFunctionCommands.api, org: 'particle' })).to.be.true;
			expect(logicListStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.firstCall.args[0]).to.equal(`No Logic Functions deployed in particle.${os.EOL}`);
		});

	});

	describe('get', () => {
		let lf;

		beforeEach(() => {
			lf = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
			});
			lf.files = {
				sourceCode: { name: 'code.js' },
				configuration: { name:'config.json' }
			};
		});

		it('gets a logic function with an specific name from Sandbox account', async () => {
			const logicGetStub = sinon.stub(LogicFunction, 'getByIdOrName').resolves(lf);
			lf.saveToDisk = sinon.stub().resolves(true);
			sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.get({ name: 'LF1', params: {} });
			expect(logicGetStub.calledWith({ org: undefined, id: undefined, name: 'LF1', list: logicFunc1.logic_functions })).to.be.true;
			expect(logicGetStub.calledOnce).to.be.true;
			expect(lf.saveToDisk.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(6);
			expect(logicFunctionCommands.ui.stdout.write.getCall(2).args[0]).to.equal(` - ${lf.files.configuration.name}${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write.getCall(3).args[0]).to.equal(` - ${lf.files.sourceCode.name}${os.EOL}`);
		});
		it('gets a logic function with an specific id from Sandbox account', async () => {
			const logicGetStub = sinon.stub(LogicFunction, 'getByIdOrName').resolves(lf);
			lf.saveToDisk = sinon.stub().resolves(true);
			sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.get({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b', params: {} });
			expect(logicGetStub.calledWith({ org: undefined, id: '0021e8f4-64ee-416d-83f3-898aa909fb1b', name: undefined, list: logicFunc1.logic_functions })).to.be.true;
			expect(logicGetStub.calledOnce).to.be.true;
			expect(lf.saveToDisk.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(6);
			expect(logicFunctionCommands.ui.stdout.write.getCall(2).args[0]).to.equal(` - ${lf.files.configuration.name}${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write.getCall(3).args[0]).to.equal(` - ${lf.files.sourceCode.name}${os.EOL}`);

		});
		it('shows error if logic function is not found', async () => {
			const logicGetStub = sinon.stub(LogicFunction, 'getByIdOrName').rejects(new Error('Logic function not found'));
			lf.saveToDisk = sinon.stub().resolves(true);
			sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			let error;
			try {
				await logicFunctionCommands.get({ name: 'LF3', params: {} });
			} catch (e) {
				error = e;
			}
			expect(logicGetStub.calledWith({ org: undefined, id: undefined, name: 'LF3', list: logicFunc1.logic_functions })).to.be.true;
			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Logic function not found');
		});

		it('gets a logic function with an specific name from an org', async () => {
			const logicGetStub = sinon.stub(LogicFunction, 'getByIdOrName').resolves(lf);
			lf.saveToDisk = sinon.stub().resolves(true);
			sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.get({ name: 'LF1', org: 'particle', params: {} });
			expect(logicGetStub.calledWith({ org: 'particle', id: undefined, name: 'LF1', list: logicFunc1.logic_functions })).to.be.true;
			expect(logicGetStub.calledOnce).to.be.true;
			expect(lf.saveToDisk.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(6);
			expect(logicFunctionCommands.ui.stdout.write.getCall(2).args[0]).to.equal(` - ${lf.files.configuration.name}${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write.getCall(3).args[0]).to.equal(` - ${lf.files.sourceCode.name}${os.EOL}`);
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
			sinon.stub(logicFunctionCommands, '_confirmOverwriteIfNeeded').resolves(true);
			const name = 'LF1';
			const slugName = slugify(name);

			const { jsonPath, jsPath } = await logicFunctionCommands._generateFiles({ logicFunctionConfigData, logicFunctionCode, name: 'LF1' });

			expect(jsonPath).to.eql(path.join(process.cwd(), `${slugName}.logic.json`));
			expect(jsPath).to.eql(path.join(process.cwd(), `${slugName}.js`));

			await fs.remove(jsonPath);
			await fs.remove(jsPath);
		});
	});

	describe('_getLocalLFPathNames', async() => {
		it('returns local file paths where the LF should be saved', () => {
			const slugName = slugify('LF1');
			const { jsonPath, jsPath } = logicFunctionCommands._getLocalLFPathNames('LF1');

			expect(jsonPath).to.eql(path.join(process.cwd(), `${slugName}.logic.json`));
			expect(jsPath).to.eql(path.join(process.cwd(), `${slugName}.js`));
		});
	});

	describe('create', () => {
		let initFromTemplateStub, saveToDiskStub;
		beforeEach(() => {
			initFromTemplateStub = sinon.stub(LogicFunction.prototype, 'initFromTemplate').resolves(true);
			saveToDiskStub = sinon.stub(LogicFunction.prototype, 'saveToDisk').resolves(true);
		});
		afterEach(() => {
			sinon.restore();
		});

		it('creates a logic function locally for Sandbox account', async () => {
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'logic func 1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });
			await logicFunctionCommands.create({ params: { filepath: PATH_TMP_DIR } });
			expect(initFromTemplateStub.calledOnce).to.be.true;
			expect(saveToDiskStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.secondCall.args[0]).to.equal(`Creating Logic Function logic func 1 for your Sandbox...${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write.thirdCall.args[0]).to.equal(`Successfully created logic func 1 locally in ${PATH_TMP_DIR}`);
		});

		it('ask to overwrite if files already exist', async () => {
			sinon.stub(fs, 'pathExists').resolves(true);
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'logic func 1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });
			logicFunctionCommands.ui.prompt.onCall(2).resolves({ overwrite: true });
			await logicFunctionCommands.create({ params: { filepath: PATH_TMP_DIR } });
			expect(initFromTemplateStub.calledOnce).to.be.true;
			expect(saveToDiskStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(3);
			expect(logicFunctionCommands.ui.stdout.write.secondCall.args[0]).to.equal(`Creating Logic Function logic func 1 for your Sandbox...${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write.thirdCall.args[0]).to.equal(`Successfully created logic func 1 locally in ${PATH_TMP_DIR}`);
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
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(7);
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
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(7);
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
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(8);
			expect(logicFunctionCommands.ui.chalk.bold.firstCall.args[0]).to.equal('code.js'); // file name
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

			const res = await logicFunctionCommands._confirmOverwriteIfNeeded({
				filePaths: ['dir/path/to/file'],
				_exit: sinon.stub()
			});

			expect(res).to.eql(false);

		});

		it('returns if all paths exist and not overwriting', async () => {
			const exitStub = sinon.stub();
			sinon.stub(fs, 'pathExists').resolves(true);
			sinon.stub(logicFunctionCommands, '_promptOverwrite').resolves(false);

			await logicFunctionCommands._confirmOverwriteIfNeeded({ filePaths: ['dir/path/to/file'], _exit: exitStub });

			expect(logicFunctionCommands._promptOverwrite.callCount).to.eql(1);
			expect(exitStub.callCount).to.eql(1);
		});

		it('prompts if any path exists and overwriting', async () => {
			sinon.stub(fs, 'pathExists').resolves(true);
			sinon.stub(logicFunctionCommands, '_promptOverwrite').resolves(true);
			const paths = ['dir/', 'dir/path/to/file'];

			const res = await logicFunctionCommands._confirmOverwriteIfNeeded({ filePaths: paths });

			expect(res).to.eql(true);

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

	describe('_selectLogicFunctionName', () => {
		it('selects logic function from a list', async () => {
			const logicFunctions = ['logicFunc1', 'logicFunc2'];
			const selectedLF = 'logicFunc2';
			const promptStub = sinon.stub(logicFunctionCommands, '_prompt');
			promptStub.resolves({ logic_function: selectedLF });

			const res = await logicFunctionCommands._selectLogicFunctionName(logicFunctions);

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
				await logicFunctionCommands._selectLogicFunctionName(logicFunctions);
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
			expect(logicFunctionCommands.ui.stdout.write.lastCall.lastArg).to.equal(`Aborted.${os.EOL}`);
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
			sinon.stub(logicFunctionCommands, '_overwriteIfLFExistsLocally').resolves({ });

			await logicFunctionCommands.updateStatus({ name: 'LF1' }, { enable: false });

			expect(logicFunctionCommands._printDisableOutput).to.have.been.calledOnce;
			expect(logicFunctionCommands._overwriteIfLFExistsLocally).to.have.been.calledOnce;
		});

		it('disables a logic function with id', async() => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ overwrite: true });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(201, { logic_function: logicFunc1Data });
			sinon.stub(logicFunctionCommands, '_printDisableOutput').resolves({ });
			sinon.stub(logicFunctionCommands, '_overwriteIfLFExistsLocally').resolves({ });

			await logicFunctionCommands.updateStatus({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b' }, { enable: false });

			expect(logicFunctionCommands._printDisableOutput).to.have.been.calledOnce;
			expect(logicFunctionCommands._overwriteIfLFExistsLocally).to.have.been.calledOnce;
		});

		it('fails to disable a logic function', async() => {
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(404, { error: 'Error' });
			sinon.stub(logicFunctionCommands, '_printDisableOutput').resolves({ });

			let error;
			try {
				await logicFunctionCommands.updateStatus({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b' }, { enable: false });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.contain('Error updating Logic Function LF1');
			expect(logicFunctionCommands._printDisableOutput).to.not.have.been.called;
		});
	});

	describe('deploy', () => {
		let logicFunctions = [];
		logicFunctions.push(logicFunc1.logic_functions[0]);

		beforeEach(() => {
			logicFunctionCommands.logicFuncList = logicFunctions;
		});

		afterEach(() => {
			fs.rmSync('lf1', { recursive: true, force: true });
			nock.cleanAll();
		});

		it('deploys a new logic function', async() => {
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions', 'POST')
				.reply(200, { logic_function: logicFunc2.logic_functions[0] });
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ proceed: true });
			sinon.stub(logicFunctionCommands, 'execute').resolves({ logicConfigContent: { logic_function: logicFunc2.logic_functions[0] }, logicCodeContent: logicFunc2.logic_functions[0].source.code });
			sinon.stub(logicFunctionCommands, '_printDeployNewLFOutput').resolves({ });

			await logicFunctionCommands.deploy({ params: { filepath: 'test/lf1' } });

			expect(logicFunctionCommands._prompt).to.have.property('callCount', 1);
			expect(logicFunctionCommands.execute).to.have.been.calledOnce;
			expect(logicFunctionCommands._printDeployNewLFOutput).to.have.been.calledOnce;

		});

		it('re-deploys an old logic function', async() => {
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(200, { logic_function: logicFunc1.logic_functions[0] });
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ proceed: true });
			sinon.stub(logicFunctionCommands, 'execute').resolves({ logicConfigContent: { logic_function: logicFunc1.logic_functions[0] }, logicCodeContent: logicFunc1.logic_functions[0].source.code });
			sinon.stub(logicFunctionCommands, '_printDeployOutput').resolves({ });

			await logicFunctionCommands.deploy({ params: { filepath: 'test/lf1' } });

			expect(logicFunctionCommands._prompt).to.have.property('callCount', 2);
			expect(logicFunctionCommands.execute).to.have.been.calledOnce;
			expect(logicFunctionCommands._printDeployOutput).to.have.been.calledOnce;
		});

		it('throws an error if deployement fails', async() => {
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(500, { error: 'Error' });
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ proceed: true });
			sinon.stub(logicFunctionCommands, 'execute').resolves({ logicConfigContent: { logic_function: logicFunc1.logic_functions[0] }, logicCodeContent: logicFunc1.logic_functions[0].source.code });
			sinon.stub(logicFunctionCommands, '_printDeployOutput').resolves({ });

			let error;
			try {
				await logicFunctionCommands.deploy({ params: { filepath: 'test/lf1' } });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.contain('Error deploying Logic Function LF1');

		});
	});

	describe('enable', () => {
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

		it('enable a logic function with name', async() => {
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(201, { logic_function: logicFunc1Data });
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ overwrite: true });
			sinon.stub(logicFunctionCommands, '_printEnableOutput').resolves({ });
			sinon.stub(logicFunctionCommands, '_overwriteIfLFExistsLocally').resolves({ });

			await logicFunctionCommands.updateStatus({ name: 'LF1' }, { enable: true });

			expect(logicFunctionCommands._printEnableOutput).to.have.been.calledOnce;
			expect(logicFunctionCommands._overwriteIfLFExistsLocally).to.have.been.calledOnce;
		});

		it('enable a logic function with id', async() => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ overwrite: true });
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(201, { logic_function: logicFunc1Data });
			sinon.stub(logicFunctionCommands, '_printEnableOutput').resolves({ });
			sinon.stub(logicFunctionCommands, '_overwriteIfLFExistsLocally').resolves({ });

			await logicFunctionCommands.updateStatus({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b' }, { enable: true });

			expect(logicFunctionCommands._printEnableOutput).to.have.been.calledOnce;
			expect(logicFunctionCommands._overwriteIfLFExistsLocally).to.have.been.calledOnce;
		});

		it('fails to enable a logic function', async() => {
			nock('https://api.particle.io/v1',)
				.intercept('/logic/functions/0021e8f4-64ee-416d-83f3-898aa909fb1b', 'PUT')
				.reply(404, { error: 'Error' });
			sinon.stub(logicFunctionCommands, '_printEnableOutput').resolves({ });

			let error;
			try {
				await logicFunctionCommands.updateStatus({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b' }, { enable: true });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.contain('Error updating Logic Function LF1');
			expect(logicFunctionCommands._printEnableOutput).to.not.have.been.called;
		});
	});
});
