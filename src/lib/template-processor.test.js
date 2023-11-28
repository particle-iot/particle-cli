const { expect } = require('../../test/setup');
const { copyAndReplaceTemplate, hasTemplateFiles } = require('./template-processor');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const fs = require('fs-extra');
const path = require('path');

describe('template-processor', () => {
	afterEach(async () => {
		await fs.emptyDir(PATH_TMP_DIR);
	});
	describe('copyAndReplaceTemplate', () => {
		it('copies template files to destination', async () => {
			const templatePath = path.join(__dirname, '..', '..', 'assets', 'logicFunction');
			const destinationPath = path.join(PATH_TMP_DIR, 'tmp-logic-function');
			const replacements = {
				name: 'My Logic Function',
				description: 'My Logic Function Description',
			};
			const templates = await fs.readdir(templatePath);
			const createdFiles = [];
			for (const template of templates){
				const createdFile = await copyAndReplaceTemplate({
					file: template,
					templatePath,
					destinationPath,
					replacements
				});
				createdFiles.push(createdFile);
			}
			// check files were copied
			const files = await fs.readdir(destinationPath);
			const templateFiles = await fs.readdir(templatePath);
			expect(files).to.have.lengthOf(templateFiles.length);
			expect(createdFiles).to.have.lengthOf(templateFiles.length);
			const templateFileNames = templateFiles.map((file) => file.replace('.template', ''));
			expect(files).to.have.all.members(templateFileNames);
			// check content was replaced
			const codeContent = await fs.readFile(path.join(destinationPath, 'logic_function_name.logic.json'), 'utf8');
			expect(codeContent).to.include(replacements.name);
			expect(codeContent).to.include(replacements.description);
		});
	});

	describe('hasTemplateFiles', () => {
		const logicFunctionPath = 'tmp-logic-function';
		beforeEach(async () => {
			await fs.emptyDir(path.join(PATH_TMP_DIR, logicFunctionPath));
		});

		it('returns true if template files exist in destination', async () => {
			const templatePath = path.join(__dirname, '..', '..', 'assets', 'logicFunction');
			const destinationPath = path.join(PATH_TMP_DIR, logicFunctionPath);
			const replacements = {
				name: 'My Logic Function',
				description: 'My Logic Function Description',
			};
			const templates = await fs.readdir(templatePath);
			for (const template of templates){
				await copyAndReplaceTemplate({
					file: template,
					templatePath,
					destinationPath,
					replacements
				});
			}
			const hasFiles = await hasTemplateFiles({ templatePath, destinationPath });
			expect(hasFiles).to.be.true;
		});
		it('returns false if template files do not exist in destination', async () => {
			const templatePath = path.join(__dirname, '..', '..', 'assets', 'logicFunction');
			const destinationPath = path.join(PATH_TMP_DIR, logicFunctionPath);
			const hasFiles = await hasTemplateFiles({ templatePath, destinationPath });
			expect(hasFiles).to.be.false;
		});
	});

});
