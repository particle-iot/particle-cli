const { expect, sinon } = require('../../test/setup');
const { JSONResult, JSONErrorResult } = require('./json-result');


describe('JSON Formatted Command Results', () => {
	const sandbox = sinon.createSandbox();

	afterEach(() => {
		sandbox.restore();
	});

	describe('JSON Result Object', () => {
		it('Formats an empty JSON result', () => {
			const result = new JSONResult();
			expect(result).to.have.all.keys('meta', 'data');
			expect(result.meta).to.eql({ version: '1.0.0' });
			expect(result.data).to.eql({});
		});

		it('Formats an JSON result with customized `meta`', () => {
			const meta = { test: true };
			const result = new JSONResult(meta);
			expect(result).to.have.all.keys('meta', 'data');
			expect(result.meta).to.eql({ version: '1.0.0', test: true });
			expect(result.data).to.eql({});
		});

		it('Formats an JSON result with customized `data`', () => {
			const data = { id: '123A' };
			const result = new JSONResult(undefined, data);
			expect(result).to.have.all.keys('meta', 'data');
			expect(result.meta).to.eql({ version: '1.0.0' });
			expect(result.data).to.eql({ id: '123A' });
		});

		it('Formats an JSON result with customized `meta` and `data`', () => {
			const meta = { test: true };
			const data = { id: '123A' };
			const result = new JSONResult(meta, data);
			expect(result).to.have.all.keys('meta', 'data');
			expect(result.meta).to.eql({ version: '1.0.0', test: true });
			expect(result.data).to.eql({ id: '123A' });
		});

		it('Serializes result as JSON', () => {
			const meta = { test: true };
			const data = { id: '123A' };
			const result = new JSONResult(meta, data);
			const json = JSON.stringify(result);
			expect(json).to.equal('{"meta":{"version":"1.0.0","test":true},"data":{"id":"123A"}}');
		});

		it('Converts result to string', () => {
			const meta = { test: true };
			const data = { id: '123A' };
			const result = new JSONResult(meta, data);
			expect(`${result}`).to.equal('{\n    "meta": {\n        "version": "1.0.0",\n        "test": true\n    },\n    "data": {\n        "id": "123A"\n    }\n}');
		});
	});

	describe('JSON Error Result Object', () => {
		it('Formats an empty JSON Error result', () => {
			const result = new JSONErrorResult();
			expect(result).to.have.all.keys('meta', 'cause');
			expect(result.meta).to.eql({ version: '1.0.0' });
			expect(result.cause).to.be.an.instanceof(Error);
			expect(result.cause.message).to.equal('Something went wrong');
		});

		it('Formats a JSON Error result with customized `cause`', () => {
			const cause = new Error('test');
			const result = new JSONErrorResult(cause);
			expect(result).to.have.all.keys('meta', 'cause');
			expect(result.meta).to.eql({ version: '1.0.0' });
			expect(result.cause).to.be.an.instanceof(Error);
			expect(result.cause.message).to.equal('test');
		});

		it('Serializes result as JSON', () => {
			const cause = new Error('test');
			const result = new JSONErrorResult(cause);
			const json = JSON.stringify(result);
			const obj = JSON.parse(json);

			expect(obj).to.have.all.keys('meta', 'error');
			expect(obj.meta).to.eql({ version: '1.0.0' });
			expect(obj.error).to.have.all.keys('message', 'stack');
			expect(obj.error.message).to.equal('test');
		});

		it('Converts result to string', () => {
			const cause = new Error('test');
			const result = new JSONErrorResult(cause);
			const obj = JSON.parse(`${result}`);

			expect(obj).to.have.all.keys('meta', 'error');
			expect(obj.meta).to.eql({ version: '1.0.0' });
			expect(obj.error).to.have.all.keys('message', 'stack');
			expect(obj.error.message).to.equal('test');
		});
	});
});

