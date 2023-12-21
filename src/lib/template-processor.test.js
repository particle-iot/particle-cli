const { expect } = require('../../test/setup');
const { loadTemplateFiles } = require('./template-processor');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const fs = require('fs-extra');
const path = require('path');

describe('template-processor', () => {
	afterEach(async () => {
		await fs.emptyDir(PATH_TMP_DIR);
	});
	describe('loadTemplateFiles', () => {
		it('copies template files to destination', async () => {
			const templatePath = path.join(__dirname, '..', '..', 'assets', 'logicFunction');
			const replacements = {
				name: 'My Logic Function',
				description: 'My Logic Function Description',
			};
			const fileNameReplacements = [
				{ template: 'logic_function_name', fileName: 'my-logic-function' },
			];
			const files = await loadTemplateFiles({
				templatePath,
				contentReplacements: replacements,
				fileNameReplacements,
			});

			const namedFiles = files.filter(file => file.fileName.includes('my-logic-function'));
			expect(namedFiles).to.have.length(2);
		});
		it('throws an error if the template does not exist', async () => {
			try {
				await loadTemplateFiles({ templatePath: 'invalid-template' });
			} catch (e) {
				expect(e.message).to.equal('Template not found');
			}
		});
	});

});
