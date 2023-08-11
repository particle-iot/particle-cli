const { expect } = require('../../test/setup');
const sinon = require('sinon');
const fs = require('fs-extra'); // Use fs-extra instead of fs
const Flash = require('./flash');



describe('flash', () => {
	describe('_parseLocalFlashArguments', async () => {
		let flash;

		beforeEach(() => {
			flash = new Flash();
		});

		afterEach(() => {
			sinon.restore();
		});

		it('should parse local flash arguments with valid binary', async () => {
			const binary = 'path/to/binary';
			const files = ['file1', 'file2'];
			sinon.stub(fs, 'stat').resolves({ isFile: () => true, isDirectory: () => false });

			const result = await flash._parseLocalFlashArguments({ binary, files });

			expect(result.device).to.be.undefined;
			expect(result.files).to.deep.equal([...files, binary]);
		});

		it('should parse local flash arguments with nonexistent binary', async () => {

			const binary = 'e00fce68f15867a3c4762226';
			const files = ['file1', 'file2'];
			const error = new Error('File not found');
			sinon.stub(fs, 'stat').rejects(error);

			const result = await flash._parseLocalFlashArguments({ binary, files });

			expect(result.device).to.equal(binary);
			expect(result.files).to.deep.equal(files);
		});

		it('should parse local flash arguments with missing binary and files', async () => {
			const binary = undefined;
			const files = [];
			const result = await flash._parseLocalFlashArguments({ binary, files });

			expect(result.device).to.be.undefined;
			expect(result.files).to.deep.equal(['.']);
		});

		it('should parse local flash arguments without files', async () => {
			const binary = './';
			const files = [];
			const result = await flash._parseLocalFlashArguments({ binary, files });

			expect(result.device).to.be.undefined;
			expect(result.files).to.deep.equal([binary]);
		});

		it('should parse local flash with deviceId and nothing else', async () => {
			const binary = '00fce68f15867a3c4762226';
			const files = [];
			const result = await flash._parseLocalFlashArguments({ binary, files });
			expect(result.device).to.equal(binary);
			expect(result.files).to.deep.equal(['.']);
		});
	});
});
