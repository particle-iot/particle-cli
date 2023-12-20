const fs = require('fs-extra');
const path = require('path');

async function loadTemplateFiles({ templatePath, contentReplacements, fileNameReplacements }){
	if (!await fs.pathExists(templatePath)){
		throw new Error('Template not found');
	}
	const templateFiles = await fs.readdir(templatePath);
	const files = [];
	for (const file of templateFiles){
		const filePath = path.join(templatePath, file);
		const stats = await fs.stat(filePath);
		if (stats.isDirectory()){
			const subFiles = await loadTemplateFiles({ templatePath: filePath, contentReplacements, fileNameReplacements });
			files.push(...subFiles);
		} else {
			const file = await copyTemplateToString({ filePath, contentReplacements, fileNameReplacements });
			files.push(file);
		}
	}
	return files;
}

async function copyTemplateToString({ filePath, contentReplacements, fileNameReplacements }) {
	// open the file
	const file = await fs.readFile(filePath, 'utf8');
	// replace the content
	const content = replace(file, contentReplacements);
	// replace the file name
	let fileName = filePath.replace('.template', '');
	const replacement = fileNameReplacements.find((replacement) => {
		return fileName.includes(replacement.template);
	});

	if (replacement){
		fileName = fileName.replace(replacement.template, replacement.fileName);
	}
	return {
		fileName: fileName,
		content: content
	};
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
	loadTemplateFiles
};
