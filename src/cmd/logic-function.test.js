const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const nock = require('nock');
const { expect, sinon } = require('../../test/setup');
const LogicFunctionCommands = require('./logic-function');
const { PATH_FIXTURES_LOGIC_FUNCTIONS, PATH_TMP_DIR } = require('../../test/lib/env');
const templateProcessor = require('../lib/template-processor');




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

	describe('list', () => {
		it('lists logic functions in Sandbox', async () => {
			const stub = nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, logicFunc1);
			const expectedResp = logicFunc1.logic_functions;

			const res = await logicFunctionCommands.list({});
			expect(res).to.eql(expectedResp);
			expect (stub.isDone()).to.be.true;
		});

		it('lists logic functions in Org', async () => {
			const stub = nock('https://api.particle.io/v1/orgs/particle')
				.intercept('/logic/functions', 'GET')
				.reply(200, logicFunc2);
			const expectedResp = logicFunc2.logic_functions;

			const res = await logicFunctionCommands.list({ org: 'particle' });
			expect(res).to.eql(expectedResp);
			expect (stub.isDone()).to.be.true;
		});

		it('shows relevant msg is no logic functions are found', async () => {
			const stub = nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: [] });
			const expectedResp = [];

			const res = await logicFunctionCommands.list({});
			expect(res).to.eql(expectedResp);
			expect(logicFunctionCommands.ui.stdout.write.callCount).to.equal(2);
			expect(logicFunctionCommands.ui.stdout.write.firstCall.args[0]).to.equal('No Logic Functions currently deployed in your Sandbox.');
			expect (stub.isDone()).to.be.true;
		});

		it('throws an error if API is not accessible', async () => {
			const stub = nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(500, { error: 'Internal Server Error' });

			let error;
			try {
				await logicFunctionCommands.list({});
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Error listing logic functions: Internal Server Error');
			expect (stub.isDone()).to.be.true;
		});

		it('throws an error if org is not found', async () => {
			nock('https://api.particle.io/v1/orgs/particle')
				.intercept('/logic/functions', 'GET')
				.reply(404, { error: 'Organization Not Found' });

			let error;
			try {
				await logicFunctionCommands.list({ org: 'particle' });
			} catch (e) {
				error = e;
			}

			expect(error).to.be.an.instanceOf(Error);
			expect(error.message).to.equal('Error listing logic functions: Organization Not Found');
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
			nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(403);
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'logicFunc1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });

			await logicFunctionCommands.create({
				params: { filepath: PATH_TMP_DIR }
			});
			expect(logicFunctionCommands.ui.chalk.yellow.callCount).to.equal(1);
			expect(logicFunctionCommands.ui.chalk.yellow.firstCall.args[0]).to.equal(`Warn: We were unable to check if a Logic Function with name logicFunc1 already exists.${os.EOL}`);
		});

		it('ask to overwrite if files already exist', async () => {
			nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: [] });
			sinon.stub(templateProcessor, 'getExistingTemplateFiles').resolves(['file1', 'file2']);
			logicFunctionCommands.ui.prompt = sinon.stub();
			logicFunctionCommands.ui.prompt.onCall(0).resolves({ name: 'logicFunc1' });
			logicFunctionCommands.ui.prompt.onCall(1).resolves({ description: 'Logic Function 1' });
			logicFunctionCommands.ui.prompt.onCall(2).resolves({ overwrite: true });
			await logicFunctionCommands.create({
				params: { filepath: PATH_TMP_DIR }
			});
			expect(logicFunctionCommands.ui.prompt.callCount).to.equal(3);
			expect(logicFunctionCommands.ui.prompt.thirdCall.lastArg[0].message).to.contain('We found existing files in');
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
			expect(error.message).to.equal('Error: Logic Function with name LF1 already exists.');
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
			expect(logicFunctionCommands.ui.prompt.firstCall.lastArg[0].choices[0].name).to.equal('code.js');
			expect(logicFunctionCommands.ui.prompt.firstCall.lastArg[0].choices[1].name).to.equal('code2.js');
		});
	});
});
