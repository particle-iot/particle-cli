const { expect } = require('../../test/setup');
const { copyAndReplaceTemplate } = require('./template-processor');
const { PATH_TMP_DIR } = require('../../test/lib/env');
const fs = require('fs-extra');
const path = require('path');

describe('template-processor', () => {
	it('copies template files to destination', async () => {
		const templatePath = __dirname + '/../../assets/logicFunction';
		const destinationPath = path.join(PATH_TMP_DIR, 'tmp-logic-function');
		const replacements = {
			name: 'My Logic Function',
			description: 'My Logic Function Description',
		};
		const createdFiles = await copyAndReplaceTemplate({ templatePath, destinationPath, replacements });
		// check files were copied
		const files = await fs.readdir(destinationPath);
		const templateFiles = await fs.readdir(templatePath);
		expect(files).to.have.lengthOf(templateFiles.length);
		expect(createdFiles).to.have.lengthOf(templateFiles.length);
		const templateFileNames = templateFiles.map((file) => file.replace('.template', ''));
		expect(files).to.have.all.members(templateFileNames);
		// check content was replaced
		const codeContent = await fs.readFile(path.join(destinationPath, 'configuration.json'), 'utf8');
		expect(codeContent).to.include(replacements.name);
		expect(codeContent).to.include(replacements.description);
	});
});
