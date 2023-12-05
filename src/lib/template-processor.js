const fs = require('fs-extra');
const path = require('path');

/**
 * This function will copy a template file to a destination path and replace the content with the replacements
 * @param file - The file object
 * @param file.fileName - The file name
 * @param file.content - The file content as string
 * @param destinationPath - The destination path
 * @param replacements - The replacements to be done in the file content
 * @return {Promise<string>} - The destination file path
 */
async function copyAndReplaceTemplate({ file, destinationPath, replacements }) {
	// sometimes the file name has a path, so we need to create the path in the destination
	const fileNamePath = path.parse(file.fileName).dir;
	const fileName = path.parse(file.fileName).base;
	const fullPath = path.join(destinationPath, fileNamePath);
	await fs.ensureDir(fullPath);
	const destinationFile = path.join(fullPath, fileName);
	const templateContent = file.content;
	const destinationContent = replaceContent(templateContent, replacements);
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
	const files = await getFilesToBeCreated({ templatePath, fileNameReplacements });
	const foundFiles = [];
	for (const file of files){
		const destinationFile = path.join(destinationPath, file.fileName);
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

/**
 *
 * @param templatePath
 * @param fileNameReplacements[]
 * @param fileNameReplacements.template - The template name
 * @param fileNameReplacements.fileName - The destination file name
 * @param originalPath
 * @returns {Promise<[Object]>} - Array of objects with the file name and content
 * @returns {Promise<[Object.fileName]>} - The file name
 * @returns {Promise<[Object.content]>} - The file content as string
 */
async function getFilesToBeCreated({ templatePath, fileNameReplacements = [], originalPath = '' }){
	const templates = await fs.readdir(templatePath);
	const files = [];
	// for each template file get the content and change the name
	for (const template of templates){
		// if template is a directory, call this function recursively
		const stats = await fs.stat(path.join(templatePath, template));
		if (stats.isDirectory()){
			const dirFiles = await getFilesToBeCreated({
				templatePath: path.join(templatePath, template),
				fileNameReplacements,
				originalPath: template
			});
			files.push(...dirFiles);

		} else {
			let fileName = template.replace('.template', '');
			const replacement = fileNameReplacements.find((replacement) => {
				return template.includes(replacement.template);
			});
			if (replacement) {
				fileName = fileName.replace(replacement.template, replacement.fileName);
			}
			const templateFile = path.join(templatePath, template);
			const content = await fs.readFile(templateFile, 'utf8');
			files.push({ fileName: path.join(originalPath, fileName), content });
		}
	}

	return files;
}

function replaceContent(content, replacements){
	let result = content;
	for (const key in replacements){
		const value = replacements[key];
		result = result.replace(new RegExp(`\\$\{${key}}`, 'g'), value);
	}
	return result;
}

async function copyTemplatesFromPath({ templatePath, destinationPath, replacements, fileNameReplacements = [] }){
	const files = await getFilesToBeCreated({ templatePath, fileNameReplacements });
	const copiedFiles = [];
	for (const file of files){
		// check if file is a directory
		const copiedFile = await copyAndReplaceTemplate({
			file,
			destinationPath,
			replacements
		});
		copiedFiles.push(copiedFile);
	}
	return copiedFiles;
}

module.exports = {
	copyAndReplaceTemplate,
	getExistingTemplateFiles,
	copyTemplatesFromPath,
	getFilesToBeCreated
};
