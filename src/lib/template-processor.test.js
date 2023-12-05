const { expect } = require('../../test/setup');
const { copyAndReplaceTemplate, getExistingTemplateFiles, copyTemplatesFromPath } = require('./template-processor');
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
			let templates = await fs.readdir(templatePath);
			// filter out @types from templates
			templates = templates.filter((template) => !template.includes('@types'));
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
			expect(files).to.have.lengthOf(templates.length);
			expect(createdFiles).to.have.lengthOf(templates.length);
			const templateFileNames = templates.map((file) => file.replace('.template', ''));
			expect(files).to.have.all.members(templateFileNames);
			// check content was replaced
			const codeContent = await fs.readFile(path.join(destinationPath, 'logic_function_name.logic.json'), 'utf8');
			expect(codeContent).to.include(replacements.name);
			expect(codeContent).to.include(replacements.description);
		});
	});

	describe('getExistingTemplateFiles', () => {
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
			let templates = await fs.readdir(templatePath);
			// filter out @types from templates
			templates = templates.filter((template) => !template.includes('@types'));
			for (const template of templates){
				await copyAndReplaceTemplate({
					file: template,
					templatePath,
					destinationPath,
					replacements
				});
			}
			const hasFiles = await getExistingTemplateFiles({
				templatePath,
				destinationPath,
				fileNameReplacements: [
					{ template: 'logic_function_name', fileName: 'logic_function_name' },
				]
			});
			expect(hasFiles).to.have.lengthOf(templates.length);
		});
		it('returns false if template files do not exist in destination', async () => {
			const templatePath = path.join(__dirname, '..', '..', 'assets', 'logicFunction');
			const destinationPath = path.join(PATH_TMP_DIR, logicFunctionPath);
			const hasFiles = await getExistingTemplateFiles({ templatePath, destinationPath });
			expect(hasFiles).to.have.lengthOf(0);
		});
	});

	describe('copyTemplatesFromPath', () => {
		it('copies template files to destination recursively', async () => {
			const templatePath = path.join(__dirname, '..', '..', 'assets', 'logicFunction');
			const destinationPath = path.join(PATH_TMP_DIR, 'tmp-logic-function');
			const replacements = {
				name: 'My Logic Function',
				description: 'My Logic Function Description',
			};
			const fileNameReplacements = [
				{ template: 'logic_function_name', fileName: 'my-logic-function' },
			];
			const files = await copyTemplatesFromPath({
				templatePath,
				destinationPath,
				replacements,
				fileNameReplacements
			});
			expect(files).to.have.lengthOf(4);
			expect(files).to.have.members([
				path.join(destinationPath, '@types', 'particle_core.d.ts'),
				path.join(destinationPath, '@types', 'particle_encoding.d.ts'),
				path.join(destinationPath, 'my-logic-function.js'),
				path.join(destinationPath, 'my-logic-function.logic.json'),
			]);
			// check content was replaced
			const codeContent = await fs.readFile(path.join(destinationPath, 'my-logic-function.logic.json'), 'utf8');
			expect(codeContent).to.include(replacements.name);
			expect(codeContent).to.include(replacements.description);
		});
	});

});
