const { expect } = require('../../test/setup');
const LogicFunctionCommands = require('./logic-function');
const fs = require('fs');
const path = require('path');
const nock = require('nock');
const { PATH_FIXTURES_LOGIC_FUNCTIONS } = require('../../test/lib/env');



describe('LogicFunctionCommands', () => {
	let logicFunctionCommands;
	let logicFunc1 = fs.readFileSync(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'logicFunc1.json'), 'utf-8');
	logicFunc1 = JSON.parse(logicFunc1);
	let logicFunc2 = fs.readFileSync(path.join(PATH_FIXTURES_LOGIC_FUNCTIONS, 'logicFunc2.json'), 'utf-8');
	logicFunc2 = JSON.parse(logicFunc2);

	beforeEach(async () => {
		logicFunctionCommands = new LogicFunctionCommands();
	});

	afterEach(async () => {
		// TODO: Fill this out?
	});

	describe('list', () => {
		it('lists logic functions in Sandbox', async () => {
			const stub = nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, logicFunc1);
			const expectedResp = {
				body: logicFunc1,
				statusCode: 200
			};

			const res = await logicFunctionCommands.list({});
			expect(res).to.eql(expectedResp);
			expect (stub.isDone()).to.be.true;
		});

		it('lists logic functions in Org', async () => {
			const stub = nock('https://api.particle.io/v1/orgs/particle')
				.intercept('/logic/functions', 'GET')
				.reply(200, logicFunc2);
			const expectedResp = {
				body: logicFunc2,
				statusCode: 200
			};

			const res = await logicFunctionCommands.list({ org: 'particle' });
			expect(res).to.eql(expectedResp);
			expect (stub.isDone()).to.be.true;
		});

		it('shows relevant msg is no logic functions are found', async () => {
			const stub = nock('https://api.particle.io/v1', )
				.intercept('/logic/functions', 'GET')
				.reply(200, { logic_functions: [] });
			const expectedResp = {
				body: { logic_functions: [] },
				statusCode: 200
			};

			const res = await logicFunctionCommands.list({});
			expect(res).to.eql(expectedResp);
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
});
