const fs = require('fs-extra');
const path = require('path');

async function copyAndReplaceTemplate({ templatePath, destinationPath, replacements }){
	const files = await fs.readdir(templatePath);
	const createdFiles = [];
	// ensure destination path exists

	await fs.ensureDir(destinationPath);
	for (const file of files){
		const templateFile = path.join(templatePath, file);
		const fileName = file.replace('.template', '');
		const destinationFile = path.join(destinationPath, fileName);
		const templateContent = await fs.readFile(templateFile, 'utf8');
		const destinationContent = replace(templateContent, replacements);
		await fs.writeFile(destinationFile, destinationContent);
		createdFiles.push(destinationFile);
	}
	// return file name created
	return createdFiles;
}

async function hasTemplateFiles({ templatePath, destinationPath }){
	const files = await fs.readdir(templatePath);
	for (const file of files){
		const fileName = file.replace('.template', '');
		const destinationFile = path.join(destinationPath, fileName);
		try {
			await fs.stat(destinationFile);
			return true; // File exists in the destination path
		} catch (error) {
			// File doesn't exist, continue checking other files
		}
	}
	return false;
}

function replace(content, replacements){
	let result = content;
	for (const key in replacements){
		const value = replacements[key];
		result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value);
	}
	return result;
}

module.exports = {
	copyAndReplaceTemplate,
	hasTemplateFiles
};
