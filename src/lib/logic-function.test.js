const { expect, sinon } = require('../../test/setup');
const LogicFunction = require('./logic-function');
const nock = require('nock');
const logicFunc1 = require('../../test/__fixtures__/logic_functions/logicFunc1.json');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const path = require('path');
const templateProcessor = require('./template-processor');
const LOGIC_FUNCTION_FIXTURES = path.join(__dirname, '../', '../', 'test', '__fixtures__', 'logic_functions');
const fs = require('fs-extra');

describe('LogicFunction', () => {
	beforeEach(() => {
		nock.cleanAll();
		fs.emptyDirSync(PATH_TMP_DIR);
	});
	describe('list', () => {
		it('returns an empty array if there are no logic functions', async () => {
			nock('https://api.particle.io/v1/', )
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions : [] } );
			const logicFunctions = await LogicFunction.listFromCloud();
			expect(logicFunctions).to.have.lengthOf(0);
		});
		it('returns a list of logic functions', async () => {
			nock('https://api.particle.io/v1/', )
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions : [{ name: 'my-logic-function' }] } );

			const logicFunctions = await LogicFunction.listFromCloud();
			expect(logicFunctions).to.have.lengthOf(1);
			// check if the logic function is an instance of LogicFunction
			expect(logicFunctions[0]).to.be.an.instanceof(LogicFunction);
		});

		it('returns a list of logic functions from an specific org', async () => {
			nock('https://api.particle.io/v1/orgs/', )
				.intercept('/my-org/logic/functions', 'GET')
				.reply(200, { logic_functions : [{ name: 'my-logic-function' }] } );
			const logicFunctions = await LogicFunction.listFromCloud({ org: 'my-org' });
			expect(logicFunctions).to.have.lengthOf(1);
			expect(logicFunctions[0]).to.be.an.instanceof(LogicFunction);
		});

		it('propagates errors', async () => {
			nock('https://api.particle.io/v1/orgs/', )
				.intercept('/my-org/logic/functions', 'GET')
				.reply(500, { error: 'Internal Server Error' } );

			try {
				await LogicFunction.listFromCloud({ org: 'my-org' });
			} catch (error) {
				expect(error.message).to.equal('Error listing logic functions: Internal Server Error');
			}
		});
	});
	describe('getByIdOrName', () => {
		it ('throws an error if the logic function is not found', async () => {
			try {
				const logicFunctions = [];
				await LogicFunction.getByIdOrName({ org: 'my-org', name: 'my-logic-function', list: logicFunctions });
			} catch (error) {
				expect(error.message).to.equal('Logic function not found');
			}
		});
		it('returns a logic function by name', async () => {
			const logicFunctions = [new LogicFunction(logicFunc1.logic_functions[0])];
			logicFunctions[0].files.sourceCode.content = logicFunc1.logic_functions[0].source.code;
			const logicFunction = await LogicFunction.getByIdOrName({ name: 'LF1', list: logicFunctions });
			const expectedLogicFunction = {
				name: 'LF1',
				description: 'Logic Function 1 on SandBox',
				id: '0021e8f4-64ee-416d-83f3-898aa909fb1b',
				enabled: true,
				triggers: [],
				type: 'JavaScript',
				files: {
					sourceCode: {
						name: 'lf1.js',
						content: 'import Particle from \'particle:core\';\nexport default function main({ event }) {\n   Particle.publish(\'logic-publish\', event.eventData, { productId: 18552 });\n}'
					},
					configuration: {
						name: 'lf1.logic.json',
						content: ''
					},
					types:[]
				},
			};
			Object.keys(expectedLogicFunction).forEach(key => {
				expect(logicFunction).to.have.property(key);
				expect(logicFunction[key]).to.deep.equal(expectedLogicFunction[key]);
			});
		});
	});
	describe('saveToDisk', () => {
		it('saves a logic function to disk', async () => {
			const logicFunction = new LogicFunction(logicFunc1.logic_functions[0]);
			logicFunction.path = path.join(PATH_TMP_DIR, 'logic-functions', 'lf1');
			await logicFunction.saveToDisk();
			const files = await fs.readdir(logicFunction.path);
			expect(files).to.have.lengthOf(2);
			expect(files).to.include('lf1.js');
			expect(files).to.include('lf1.logic.json');

			// check if the files are correct
			const logicFunctionFile = await fs.readFile(path.join(logicFunction.path, 'lf1.logic.json'));
			const logicFunctionData = JSON.parse(logicFunctionFile);
			expect(logicFunctionData.logic_function).to.have.property('name', 'LF1');
			expect(logicFunctionData.logic_function).to.have.property('description', 'Logic Function 1 on SandBox');
			// check if the source code is correct
			const sourceCodeFile = await fs.readFile(path.join(logicFunction.path, 'lf1.js'));
			const sourceCode = sourceCodeFile.toString();
			expect(sourceCode).to.equal(logicFunction.files.sourceCode.content);
		});
	});
	describe('initFromTemplate', () => {
		afterEach(() => {
			sinon.restore();
		});

		it('initializes a logic function from a template', async () => {
			const config = {
				logic_function: {
					'name': 'my logic function',
					'description': 'my test description',
					'enabled': true,
					'source': {
						'type': 'JavaScript'
					},
					'logic_triggers': []
				}
			};
			const loadStub = sinon.stub(templateProcessor, 'loadTemplateFiles').resolves([
				{ fileName: path.join('my_path', 'lf1.js'), content: 'logic function content' },
				{ fileName: path.join('my_path', 'lf1.logic.json'), content: JSON.stringify(config) }
			]);
			const logicFunction = new LogicFunction({
				name: 'LF1',
				description: 'Logic Function 1 on SandBox',
				_path: path.join(PATH_TMP_DIR, 'logic-functions', 'lf1'),
			});
			await logicFunction.initFromTemplate({ templatePath: path.join(__dirname, 'my-template') });
			expect(loadStub).to.have.been.calledWith({
				templatePath: path.join(__dirname, 'my-template'),
				contentReplacements: {
					name: 'LF1',
					description: 'Logic Function 1 on SandBox'
				},
				fileNameReplacements: [{ fileName: 'lf1', template: 'logic_function_name' }]
			});
		});
		it('throws an error if the template does not exist', async () => {
			const loadStub = sinon.stub(templateProcessor, 'loadTemplateFiles').rejects(new Error('Template not found'));
			try {
				const logicFunction = new LogicFunction({
					name: 'LF1',
					description: 'Logic Function 1 on SandBox',
					_path: path.join(PATH_TMP_DIR, 'logic-functions', 'lf1'),
				});
				await logicFunction.initFromTemplate({ templatePath: path.join(__dirname, 'my-template') });
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error.message).to.equal('Template not found');
				expect(loadStub).to.have.been.calledWith({
					templatePath: path.join(__dirname, 'my-template'),
					contentReplacements: {
						name: 'LF1',
						description: 'Logic Function 1 on SandBox'
					},
					fileNameReplacements: [{ fileName: 'lf1', template: 'logic_function_name' }]
				});
			}
		});
	});

	describe('listFromDisk', () => {
		afterEach(() => {
			sinon.restore();
			fs.emptyDirSync(PATH_TMP_DIR);
		});
		async function createLogicFunction({ name, description }) {
			const lfPath = path.join(PATH_TMP_DIR, 'logic_functions');
			const code = 'import Particle from \'particle:core\';\nexport default function main({ event }) {\n   console.log(\'Hello from logic function!\'); \n}';
			const logicFunction = new LogicFunction({
				name,
				description,
				_path: lfPath,
			});
			logicFunction.files.sourceCode.content = code;
			await logicFunction.saveToDisk();
		}
		it('returns a list of logic functions', async () => {
			await createLogicFunction({ name: 'lf1', description: 'Logic Function 1 on SandBox' });
			const logicFunctions = await LogicFunction.listFromDisk({  path: path.join(PATH_TMP_DIR, 'logic_functions') });
			expect(logicFunctions).to.have.lengthOf(1);
			expect(logicFunctions[0]).to.be.an.instanceof(LogicFunction);
		});
		it('returns a list of logic functions with org', async () => {
			await createLogicFunction({ name: 'lf1', description: 'Logic Function 1 on SandBox' });
			const logicFunctions = await LogicFunction.listFromDisk({ path: path.join(PATH_TMP_DIR, 'logic_functions'), org: 'my-org' });
			expect(logicFunctions).to.have.lengthOf(1);
			expect(logicFunctions[0]).to.be.an.instanceof(LogicFunction);
			expect(logicFunctions[0]).to.have.property('org', 'my-org');
		});
		it('returns a list of more than one logic functions', async () => {
			await createLogicFunction({ name: 'lf1', description: 'Logic Function 1 on SandBox' });
			await createLogicFunction({ name: 'lf2', description: 'Logic Function 2 on SandBox' });
			const logicFunctions = await LogicFunction.listFromDisk({ path: path.join(PATH_TMP_DIR, 'logic_functions') });
			expect(logicFunctions).to.have.lengthOf(2);
			expect(logicFunctions[0]).to.be.an.instanceof(LogicFunction);
		});
		it('filter out files that are not logic functions', async () => {
			await createLogicFunction({ name: 'lf1', description: 'Logic Function 1 on SandBox' });
			await fs.writeFile(path.join(PATH_TMP_DIR, 'logic_functions', 'lf2.json'), '{}');
			const logicFunctions = await LogicFunction.listFromDisk({ path: path.join(PATH_TMP_DIR, 'logic_functions') });
			expect(logicFunctions).to.have.lengthOf(1);
			expect(logicFunctions[0]).to.be.an.instanceof(LogicFunction);
		});
		it('filter out no well formed logic functions', async () => {
			await createLogicFunction({ name: 'lf1', description: 'Logic Function 1 on SandBox' });
			await fs.writeFile(path.join(PATH_TMP_DIR, 'logic_functions', 'lf2.logic.json'), '{ "name": "lf2", "description": "Logic Function 2 on SandBox" }');
			const logicFunctions = await LogicFunction.listFromDisk({ path: path.join(PATH_TMP_DIR, 'logic_functions') });
			expect(logicFunctions).to.have.lengthOf(1);
			expect(logicFunctions[0]).to.be.an.instanceof(LogicFunction);
		});
		it('returns an empty list if there are no logic functions', async () => {
			const logicFunctions = await LogicFunction.listFromDisk({ path: LOGIC_FUNCTION_FIXTURES });
			expect(logicFunctions).to.have.lengthOf(0);
		});
	});
});
