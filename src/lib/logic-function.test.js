const { expect } = require('chai');
const LogicFunction = require('./logic-function');
const nock = require('nock');


describe('LogicFunction', () => {
	describe('list', ()  => {
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
		});

		it('returns a list of logic functions from an specific org', async () => {
			nock('https://api.particle.io/v1/orgs/', )
				.intercept('/my-org/logic/functions', 'GET')
				.reply(200, { logic_functions : [{ name: 'my-logic-function' }] } );
			const logicFunctions = await LogicFunction.listFromCloud({ org: 'my-org' });
			expect(logicFunctions).to.have.lengthOf(1);
		});

		it('propagates errors', async () => {
			nock('https://api.particle.io/v1/orgs/', )
				.intercept('/my-org/logic/functions', 'GET')
				.reply(500, { error: 'Internal Server Error' } );

			try {
				await LogicFunction.listFromCloud({ org: 'my-org' });
			} catch (error) {
				expect(error.message).to.equal('HTTP error 500 from https://api.particle.io/v1/orgs/my-org/logic/functions');
			}
		});
	});

});
