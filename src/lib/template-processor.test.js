const { expect } = require('../../test/setup');
const { copyAndReplaceTemplate, getExistingTemplateFiles, copyTemplatesFromPath, getFilesToBeCreated } = require('./template-processor');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const fs = require('fs-extra');
const path = require('path');

describe('template-processor', () => {
	afterEach(async () => {
		await fs.emptyDir(PATH_TMP_DIR);
	});
	describe('copyAndReplaceTemplate', () => {
		it('copies template files to destination', async () => {
			const logicFunctionPath = 'tmp-logic-function';
			const destinationPath = path.join(PATH_TMP_DIR, logicFunctionPath);
			const file = {
				fileName: 'logic_function_name.js', content: 'content ${name} ${description}'
			};
			const replacements = {
				name: 'My Logic Function',
				description: 'My Logic Function Description',
			};
			const createdFile = await copyAndReplaceTemplate({
				file,
				destinationPath,
				replacements
			});
			expect(createdFile).to.equal(path.join(destinationPath, file.fileName));
			// check files were copied
			// check content was replaced
			const codeContent = await fs.readFile(path.join(destinationPath, 'logic_function_name.js'), 'utf8');
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
			let templates = await fs.readdir(templatePath);
			// filter out @types from templates
			templates = templates.filter((template) => !template.includes('@types'));
			for (const template of templates){
				await copyAndReplaceTemplate({
					file: { fileName: template.replace('.template', ''), content: '' },
					destinationPath,
					replacements: {}
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

	describe('getFilesToBeCreated', () => {
		it('returns a list of files with their raw content and file name', async () => {
			const templatePath = path.join(__dirname, '..', '..', 'assets', 'logicFunction');
			const fileNameReplacements = [
				{ template: 'logic_function_name', fileName: 'my-logic-function' },
			];
			const files = await getFilesToBeCreated({ templatePath, fileNameReplacements });
			// list of files
			const fileNames = files.map((file) => file.fileName);
			const expectedFiles = [
				'my-logic-function.js',
				'my-logic-function.logic.json',
				path.join('@types', 'particle_core.d.ts'),
				path.join('@types', 'particle_encoding.d.ts'),
			];
			expect(files).to.have.lengthOf(4);
			for (const expectedFile of expectedFiles) {
				const includesExpected = fileNames.some(file => file.includes(expectedFile));
				expect(includesExpected, `File path "${expectedFile}" does not include expected values`).to.be.true;
			}
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
