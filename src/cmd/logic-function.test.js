const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const { expect, sinon } = require('../../test/setup');
const LogicFunctionCommands = require('./logic-function');
const { PATH_FIXTURES_LOGIC_FUNCTIONS, PATH_TMP_DIR } = require('../../test/lib/env');
const LogicFunction = require('../lib/logic-function');

describe('LogicFunctionCommands', () => {
	let logicFunctionCommands;
	let originalUi = new LogicFunctionCommands().ui;
	let logicFunc1 = fs.readFileSync(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'logicFunc1.json'), 'utf-8');
	logicFunc1 = JSON.parse(logicFunc1);

	beforeEach(async () => {
		logicFunctionCommands = new LogicFunctionCommands();
		logicFunctionCommands.ui = {
			stdout: {
				write: sinon.stub()
			},
			stderr: {
				write: sinon.stub()
			},
			showBusySpinnerUntilResolved: sinon.stub().callsFake((text, promise) => promise),
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

		it('lists Logic Functions in Sandbox account', async () => {

			const logicListStub = sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.list({});
			expect(logicListStub.calledWith({ api: logicFunctionCommands.api, org: undefined })).to.be.true;
			expect(logicListStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Logic Functions deployed in your Sandbox:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`- LF1 (enabled)${os.EOL}`);
		});

		it('lists Logic Functions in an org', async () => {
			const logicListStub = sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.list({ org: 'particle' });
			expect(logicListStub.calledWith({ api: logicFunctionCommands.api, org: 'particle' })).to.be.true;
			expect(logicListStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Logic Functions deployed in particle:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`- LF1 (enabled)${os.EOL}`);
		});

		it('shows help if no Logic Functions are found', async () => {
			const logicListStub = sinon.stub(LogicFunction, 'listFromCloud').resolves([]);
			await logicFunctionCommands.list({});
			expect(logicListStub.calledWith({ api: logicFunctionCommands.api, org: undefined })).to.be.true;
			expect(logicListStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`No Logic Functions deployed in your Sandbox.${os.EOL}`);
		});

		it('shows help if no Logic Functions are found', async () => {
			const logicListStub = sinon.stub(LogicFunction, 'listFromCloud').resolves([]);
			await logicFunctionCommands.list({ api: logicFunctionCommands.api, org: 'particle' });
			expect(logicListStub.calledWith({ api: logicFunctionCommands.api, org: 'particle' })).to.be.true;
			expect(logicListStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`No Logic Functions deployed in particle.${os.EOL}`);
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

		it('gets a Logic Function with an specific name from Sandbox account', async () => {
			const logicGetStub = sinon.stub(LogicFunction, 'getByIdOrName').resolves(lf);
			lf.saveToDisk = sinon.stub().resolves(true);
			sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.get({ name: 'LF1', params: {} });
			expect(logicGetStub.calledWith({ org: undefined, id: undefined, name: 'LF1', list: logicFunc1.logic_functions })).to.be.true;
			expect(logicGetStub.calledOnce).to.be.true;
			expect(lf.saveToDisk.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(6);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(` - ${lf.files.configuration.name}${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(` - ${lf.files.sourceCode.name}${os.EOL}`);
		});
		it('gets a Logic Function with an specific id from Sandbox account', async () => {
			const logicGetStub = sinon.stub(LogicFunction, 'getByIdOrName').resolves(lf);
			lf.saveToDisk = sinon.stub().resolves(true);
			sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.get({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b', params: {} });
			expect(logicGetStub.calledWith({ org: undefined, id: '0021e8f4-64ee-416d-83f3-898aa909fb1b', name: undefined, list: logicFunc1.logic_functions })).to.be.true;
			expect(logicGetStub.calledOnce).to.be.true;
			expect(lf.saveToDisk.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(6);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(` - ${lf.files.configuration.name}${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(` - ${lf.files.sourceCode.name}${os.EOL}`);

		});
		it('shows error if Logic Function is not found', async () => {
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

		it('gets a Logic Function with an specific name from an org', async () => {
			const logicGetStub = sinon.stub(LogicFunction, 'getByIdOrName').resolves(lf);
			lf.saveToDisk = sinon.stub().resolves(true);
			sinon.stub(LogicFunction, 'listFromCloud').resolves(logicFunc1.logic_functions);
			await logicFunctionCommands.get({ name: 'LF1', org: 'particle', params: {} });
			expect(logicGetStub.calledWith({ org: 'particle', id: undefined, name: 'LF1', list: logicFunc1.logic_functions })).to.be.true;
			expect(logicGetStub.calledOnce).to.be.true;
			expect(lf.saveToDisk.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(6);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(` - ${lf.files.configuration.name}${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(` - ${lf.files.sourceCode.name}${os.EOL}`);
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

		it('creates a Logic Function locally for Sandbox account', async () => {
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'logic func 1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });
			await logicFunctionCommands.create({ params: { filepath: PATH_TMP_DIR } });
			expect(initFromTemplateStub.calledOnce).to.be.true;
			expect(saveToDiskStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Creating Logic Function logic func 1 for your Sandbox...${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Successfully created logic func 1 locally in ${PATH_TMP_DIR}`);
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
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Creating Logic Function logic func 1 for your Sandbox...${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Successfully created logic func 1 locally in ${PATH_TMP_DIR}`);
		});

	});

	describe('execute', () => {
		it('executes a Logic Function with user provided data', async () => {
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction]
			});
			const executeStub = sinon.stub(logicFunction, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});

			await logicFunctionCommands.execute({ data: '{"eventData": "someData"}' , params: {} });
			expect(logicStub.calledOnce).to.be.true;
			expect(executeStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(0);
			expect(logicFunctionCommands.ui.showBusySpinnerUntilResolved).calledWith('Executing Logic Function LF1 for your Sandbox...', logicFunction.execute());
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Execution Status: Success${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Logs from Execution:${os.EOL}`);
		});

		it('throws an error if there is no Logic Function in the directory', async () => {
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: []
			});
			let error;
			try {
				await logicFunctionCommands.execute({ data: '{"eventData": "someData"}' , params: {} });
			} catch (_error) {
				error = _error;
			}
			expect(logicStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`No Logic Functions found in your directory.${os.EOL}`);
			expect(error.message).to.equal('No Logic Functions found');
		});

		it('executes a Logic Function with user provided data from file', async () => {
			const filepath = PATH_TMP_DIR;
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction]
			});
			sinon.stub(logicFunction, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});
			await logicFunctionCommands.execute({ data: '{"eventData": "someData"}' , params: { filepath } });
			// called with the file path
			expect(logicStub).to.have.been.calledWith({ filepath, api: logicFunctionCommands.api, org: logicFunctionCommands.org });
		});
		it('executes a Logic Function with user provided data and shows error', async () => {
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction]
			});
			sinon.stub(logicFunction, 'execute').resolves({
				status: 'Exception',
				error: 'Some error',
				logs: []
			});

			await logicFunctionCommands.execute({ data: '{"eventData": "someData"}' , params: {} });

			expect(logicStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.showBusySpinnerUntilResolved).calledWith('Executing Logic Function LF1 for your Sandbox...', logicFunction.execute());
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Execution Status: Exception${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Error during Execution:${os.EOL}`);
		});
		it('prompts if found multiple Logic Functions', async () => {
			const logicFunction1 = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			const logicFunction2 = new LogicFunction({
				name: 'LF2',
				description: 'Logic Function 2',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1c',
				type: 'JavaScript',
			});
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction1, logicFunction2]
			});
			sinon.stub(logicFunction1, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});
			sinon.stub(logicFunction2, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});
			logicFunctionCommands.ui.prompt = sinon.stub().resolves({ logicFunction: 'LF1' });
			await logicFunctionCommands.execute({ data: '{"eventData": "someData"}' , params: {} });
			expect(logicStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(1);
		});
		it('executes a Logic function with provided Logic Function name', async () => {
			const lf1 = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			const lf2 = new LogicFunction({
				name: 'LF2',
				description: 'Logic Function 2',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1c',
				type: 'JavaScript',
			});
			logicFunctionCommands.ui.prompt = sinon.stub().resolves({ logicFunction: 'LF1' });
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [lf1, lf2]
			});

			const executeStub = sinon.stub(lf1, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});

			await logicFunctionCommands.execute({ name: 'LF1', params: {} });
			expect(logicStub.calledOnce).to.be.true;
			expect(executeStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(0);
			expect(logicFunctionCommands.ui.showBusySpinnerUntilResolved).calledWith('Executing Logic Function LF1 for your Sandbox...', lf1.execute());
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Execution Status: Success${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Logs from Execution:${os.EOL}`);
		});
		it('executes a Logic Function with provided Logic Function id', async () => {
			const lf1 = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			const lf2 = new LogicFunction({
				name: 'LF2',
				description: 'Logic Function 2',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1c',
				type: 'JavaScript',
			});
			logicFunctionCommands.ui.prompt = sinon.stub().resolves({ logicFunction: 'LF1' });
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [lf1, lf2]
			});

			const executeStub = sinon.stub(lf2, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});

			await logicFunctionCommands.execute({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1c', params: {} });
			expect(logicStub.calledOnce).to.be.true;
			expect(executeStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(0);
			expect(logicFunctionCommands.ui.showBusySpinnerUntilResolved).calledWith('Executing Logic Function LF2 for your Sandbox...', lf2.execute());
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Execution Status: Success${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Logs from Execution:${os.EOL}`);
		});
		it('prints malformed logic list when there are any and name/id params are not sent', async () => {
			const lf1 = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			logicFunctionCommands.ui.prompt = sinon.stub().resolves({ logicFunction: 'LF1' });
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [{ name: 'lf1', error: 'file lf1.js does not exist' }],
				logicFunctions: [lf1]
			});

			const executeStub = sinon.stub(lf1, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});

			await logicFunctionCommands.execute({ params: {} });
			expect(logicStub.calledOnce).to.be.true;
			expect(executeStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(0);
			expect(logicFunctionCommands.ui.showBusySpinnerUntilResolved).calledWith('Executing Logic Function LF1 for your Sandbox...', lf1.execute());
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Execution Status: Success${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Logs from Execution:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`The following Logic Functions are not valid:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`- lf1: file lf1.js does not exist${os.EOL}`);
		});
		it('prints malformed logic list when lf list is empty', async () => {
			let error;
			logicFunctionCommands.ui.prompt = sinon.stub().resolves({ logicFunction: 'LF1' });
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [{ name: 'lf1', error: 'file lf1.js does not exist' }],
				logicFunctions: []
			});
			try {
				await logicFunctionCommands.execute({ params: {} });
				expect.fail('should have thrown an error');
			} catch (_error) {
				error = _error;
			}
			expect(error.message).to.equal('No Logic Functions found');
			expect(logicStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(0);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`The following Logic Functions are not valid:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`- lf1: file lf1.js does not exist${os.EOL}`);
		});
		it('omit print malformed logic list when there are any and name/id are sent and lf exist', async () => {
			const lf1 = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			logicFunctionCommands.ui.prompt = sinon.stub().resolves({ logicFunction: 'LF1' });
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [{ name: 'lf1', error: 'file lf1.js does not exist' }],
				logicFunctions: [lf1]
			});

			const executeStub = sinon.stub(lf1, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});

			await logicFunctionCommands.execute({ name: 'LF1', params: {} });
			expect(logicStub.calledOnce).to.be.true;
			expect(executeStub.calledOnce).to.be.true;
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(0);
			expect(logicFunctionCommands.ui.showBusySpinnerUntilResolved).calledWith('Executing Logic Function LF1 for your Sandbox...', lf1.execute());
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Execution Status: Success${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Logs from Execution:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).to.not.have.been.calledWith(`The following Logic Functions are not valid:${os.EOL}`);
			expect(logicFunctionCommands.ui.stdout.write).to.not.have.been.calledWith(`- lf1: file lf1.js does not exist${os.EOL}`);
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

	describe('_selectLogicFunctionName', () => {
		it('selects Logic Function from a list', async () => {
			const logicFunctions = ['logicFunc1', 'logicFunc2'];
			const selectedLF = 'logicFunc2';
			const promptStub = sinon.stub(logicFunctionCommands, '_prompt');
			promptStub.resolves({ logic_function: selectedLF });

			const res = await logicFunctionCommands._selectLogicFunctionName(logicFunctions);

			expect(res).to.eql(selectedLF);
			sinon.assert.calledOnceWithExactly(promptStub, {
				type: 'list',
				name: 'logic_function',
				message: 'Which Logic Function would you like to download?',
				choices: logicFunctions,
				nonInteractiveError: 'Provide name for the Logic Function',
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
			expect(error.message).to.eql('No Logic Functions found');
		});
	});

	describe('delete', () => {
		afterEach(() => {
			sinon.restore();
		});

		it('checks for confirmation before deleting', async() => {
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ delete: true });
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});

			const listFromCloudStub = sinon.stub(LogicFunction, 'listFromCloud').resolves([logicFunction]);
			const deleteStub = sinon.stub(logicFunction, 'deleteFromCloud').resolves(undefined);

			await logicFunctionCommands.delete({ name: 'LF1' });

			expect(logicFunctionCommands._prompt).to.have.been.calledOnce;
			expect(listFromCloudStub).to.have.been.calledOnce;
			expect(deleteStub).to.have.been.calledOnce;
		});

		it('process exits if user does not want to delete during confirmation', async() => {
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});

			sinon.stub(LogicFunction, 'listFromCloud').resolves([logicFunction]);
			const deleteStub = sinon.stub(logicFunction, 'deleteFromCloud').resolves(undefined);
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ delete: false });
			await logicFunctionCommands.delete({ name: 'LF1' });

			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(1);
			expect(deleteStub).to.not.have.been.called;
			expect(logicFunctionCommands.ui.stdout.write).calledWith(`Aborted.${os.EOL}`);
		});

		it('throws an error if deletion fails', async() => {
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});

			sinon.stub(LogicFunction, 'listFromCloud').resolves([logicFunction]);
			const deleteStub = sinon.stub(logicFunction, 'deleteFromCloud').rejects(new Error('Error deleting Logic Function LF1'));
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ delete: true });

			let error;
			try {
				await logicFunctionCommands.delete({ name: 'LF1' });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.contain('Error deleting Logic Function LF1');
			expect(deleteStub).to.have.been.calledOnce;
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
		});

		it('deploys a new Logic Function', async() => {
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				type: 'JavaScript',
			});
			sinon.stub(LogicFunction, 'listFromCloud').resolves([]);
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ proceed: true });

			const deployStub = sinon.stub(logicFunction, 'deploy').resolves(undefined);
			const saveStub = sinon.stub(logicFunction, 'saveToDisk').resolves(undefined);
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction]
			});
			const executeStub = sinon.stub(logicFunction, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});

			await logicFunctionCommands.deploy({ params: { filepath: 'test/lf1' } });

			expect(logicFunctionCommands._prompt).to.have.property('callCount', 1);
			expect(deployStub).to.have.been.calledOnce;
			expect(executeStub).to.have.been.calledOnce;
			expect(logicStub).to.have.been.calledOnce;
			expect(saveStub).to.have.been.calledOnce;
			expect(logicFunctionCommands.ui.showBusySpinnerUntilResolved).calledWith('Executing Logic Function LF1 for your Sandbox...', logicFunction.execute());
		});

		it('deploys an existent Logic Function', async() => {
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				type: 'JavaScript',
			});
			sinon.stub(LogicFunction, 'listFromCloud').resolves([{ ...logicFunction, id: '0021e8f4-64ee-416d-83f3-898aa909fb1b' }]);
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ proceed: true });
			const deployStub = sinon.stub(logicFunction, 'deploy').resolves(undefined);
			const saveStub = sinon.stub(logicFunction, 'saveToDisk').resolves(undefined);
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction]
			});
			const executeStub = sinon.stub(logicFunction, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});
			await logicFunctionCommands.deploy({ params: { filepath: 'test/lf1' } });
			const expectedPromptCall = {
				message: `A Logic Function with name ${logicFunction.name} is already available in the cloud your Sandbox.${os.EOL}Proceed and overwrite with the new content?`,
			};
			expect(logicFunctionCommands._prompt).to.have.property('callCount', 2);
			expect(deployStub).to.have.been.calledOnce;
			expect(executeStub).to.have.been.calledOnce;
			expect(logicStub).to.have.been.calledOnce;
			expect(saveStub).to.have.been.calledOnce;
			expect(logicFunctionCommands.ui.showBusySpinnerUntilResolved).calledWith('Executing Logic Function LF1 for your Sandbox...', logicFunction.execute());
			expect(logicFunctionCommands._prompt).calledWith(sinon.match(expectedPromptCall));
			expect(logicFunction.id).to.equal('0021e8f4-64ee-416d-83f3-898aa909fb1b');
		});

		it('throws an error if deployement fails', async() => {
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
			sinon.stub(LogicFunction, 'listFromCloud').resolves([]);
			sinon.stub(logicFunctionCommands, '_prompt').resolves({ proceed: true });

			const deployStub = sinon.stub(logicFunction, 'deploy').rejects(new Error('Error deploying Logic Function LF1'));
			const logicStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction]
			});
			const executeStub = sinon.stub(logicFunction, 'execute').resolves({
				status: 'Success',
				logs: ['log1', 'log2']
			});
			let error;
			try {
				await logicFunctionCommands.deploy({ params: { filepath: 'test/lf1' } });
			} catch (e) {
				error = e;
			}
			expect(error).to.be.an.instanceOf(Error);
			expect(deployStub).to.have.been.calledOnce;
			expect(executeStub).to.have.been.calledOnce;
			expect(logicStub).to.have.been.calledOnce;
			expect(error.message).to.contain('Error deploying Logic Function LF1');

		});
	});

	describe('enable/disable', () => {
		let logicFunction;

		beforeEach(() => {
			logicFunction = new LogicFunction({
				org: 'my-org',
				name: 'LF1',
				enabled: false,
				description: 'Logic Function 1',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				type: 'JavaScript',
			});
		});

		afterEach(() => {
			sinon.restore();
		});

		it('enable a Logic Function with name', async() => {
			const updateStub = sinon.stub(logicFunction, 'updateToCloud').resolves(undefined);
			const listLocalStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: []
			});
			const listCloud = sinon.stub(LogicFunction, 'listFromCloud').resolves([logicFunction]);
			await logicFunctionCommands.updateStatus({ name: 'LF1', org: 'my-org', params: {} }, { enable: true });
			expect(updateStub).to.have.been.calledOnce;
			expect(listLocalStub).to.have.been.calledOnce;
			expect(listCloud).to.have.been.calledOnce;
			expect(logicFunction.enabled).to.be.true;
		});

		it('enable a Logic Function with id', async() => {
			const updateStub = sinon.stub(logicFunction, 'updateToCloud').resolves(undefined);
			const listLocalStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: []
			});
			const listCloud = sinon.stub(LogicFunction, 'listFromCloud').resolves([logicFunction]);
			await logicFunctionCommands.updateStatus({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b', org: 'my-org', params: {} }, { enable: true });
			expect(updateStub).to.have.been.calledOnce;
			expect(listLocalStub).to.have.been.calledOnce;
			expect(listCloud).to.have.been.calledOnce;
			expect(logicFunction.enabled).to.be.true;
		});

		it('fails to enable a Logic Function', async() => {
			let error;
			const updateStub = sinon.stub(logicFunction, 'updateToCloud').rejects(new Error('Error enabling Logic Function LF1'));
			const listLocalStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction]
			});
			const listCloud = sinon.stub(LogicFunction, 'listFromCloud').resolves([logicFunction]);
			try {
				await logicFunctionCommands.updateStatus({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b', org: 'my-org', params: {} }, { enable: true });
			} catch (e) {
				error = e;
			}
			expect(updateStub).to.have.been.calledOnce;
			expect(listLocalStub).to.not.have.been.calledOnce;
			expect(listCloud).to.have.been.calledOnce;
			expect(error.message).to.contain('Error enabling Logic Function LF1');
		});

		it('updates the local Logic Function if it exists in the path', async() => {
			const updateStub = sinon.stub(logicFunction, 'updateToCloud').resolves(undefined);
			const listLocalStub = sinon.stub(LogicFunction, 'listFromDisk').resolves({
				malformedLogicFunctions: [],
				logicFunctions: [logicFunction]
			});
			const saveStub = sinon.stub(logicFunction, 'saveToDisk').resolves(undefined);
			const listCloud = sinon.stub(LogicFunction, 'listFromCloud').resolves([logicFunction]);
			await logicFunctionCommands.updateStatus({ id: '0021e8f4-64ee-416d-83f3-898aa909fb1b', org: 'my-org', params: {} }, { enable: true });
			expect(updateStub).to.have.been.calledOnce;
			expect(listLocalStub).to.have.been.calledOnce;
			expect(listCloud).to.have.been.calledOnce;
			expect(logicFunction.enabled).to.be.true;
			expect(saveStub).to.have.been.calledOnce;
		});
	});
});
