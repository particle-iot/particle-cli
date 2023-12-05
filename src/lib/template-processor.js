const fs = require('fs-extra');
const path = require('path');



async function copyAndReplaceTemplate({ fileNameReplacements, file, templatePath, destinationPath, replacements }) {
	// ensure destination path exists
	await fs.ensureDir(destinationPath);
	const templateFile = path.join(templatePath, file);
	const fileName = replace(file, fileNameReplacements, { stringMatch: true }).replace('.template', '');
	const destinationFile = path.join(destinationPath, fileName);
	const templateContent = await fs.readFile(templateFile, 'utf8');
	const destinationContent = replace(templateContent, replacements);
	await fs.writeFile(destinationFile, destinationContent);
	return destinationFile;
}

/**
 * This function will get the existing files from a destination path that match the template files
 * @param templatePath
 * @param destinationPath
 * @param fileNameReplacements[] - Array with the replacements to be done in the file name
 * @param fileNameReplacements.template - The template name
 * @param fileNameReplacements.fileName - The destination file name
 * @example
 * [
 * 	{ template: 'template', fileName: 'fileName' }
 * 	{ template: 'template.js', fileName: 'fileName.js' }
 * ]
 * @returns {Promise<[String]>}
 */
async function getExistingTemplateFiles({ templatePath, destinationPath, fileNameReplacements = [] }){
	const files = await fs.readdir(templatePath);
	const foundFiles = [];
	for (const file of files){
		let fileName = file;
		const replacement = fileNameReplacements.find((replacement) => {
			return file.includes(replacement.template);
		});
		if (replacement) {
			fileName = fileName.replace(replacement.template, replacement.fileName)
				.replace('.template', '');
		}
		const destinationFile = path.join(destinationPath, fileName);
		try {
			await fs.stat(destinationFile);
			foundFiles.push(destinationFile);
			//return true; // File exists in the destination path
		} catch (error) {
			// File doesn't exist, continue checking other files
		}
	}
	return foundFiles;
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
	getExistingTemplateFiles
};
