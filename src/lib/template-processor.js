const fs = require('fs-extra');
const path = require('path');



async function copyAndReplaceTemplate({ fileNameReplacements, file, templatePath, destinationPath, replacements }) {
	const templateFile = path.join(templatePath, file);
	const fileName = replace(file, fileNameReplacements, { stringMatch: true }).replace('.template', '');
	const destinationFile = path.join(destinationPath, fileName);
	const templateContent = await fs.readFile(templateFile, 'utf8');
	const destinationContent = replace(templateContent, replacements);
	await fs.writeFile(destinationFile, destinationContent);

	return destinationFile;
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

function replace(content, replacements, options = { stringMatch: false }){
	let result = content;
	for (const key in replacements){
		const value = replacements[key];
		if (options.stringMatch){
			result = result.replace(key, value);
		} else {
			result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value);
		}
	}
	return result;
}

module.exports = {
	copyAndReplaceTemplate,
	hasTemplateFiles
};
