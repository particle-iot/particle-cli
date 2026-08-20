'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { loadTemplateFiles } = require('../lib/template-processor');
const aiTemplatePath = path.join(__dirname, '/../../assets/ai');
const CLICommandBase = require('./base');

/**
 * Commands for adding AI assistant instruction files to a project.
 * @constructor
 */
module.exports = class ProjectAICommand extends CLICommandBase {
	async addAIFiles({ dir = process.cwd() } = {}) {
		const projectPropertiesPath = path.join(dir, 'project.properties');
		if (!await fs.pathExists(projectPropertiesPath)) {
			throw new Error(`${dir} is not a Particle project directory (no project.properties found)`);
		}

		const files = await loadTemplateFiles({
			templatePath: aiTemplatePath,
			contentReplacements: {},
			fileNameReplacements: []
		});

		for (const file of files) {
			const relativePath = path.relative(aiTemplatePath, file.fileName);
			const destinationPath = path.join(dir, relativePath);
			if (await fs.pathExists(destinationPath)) {
				this.ui.stdout.write(`Skipped ${relativePath} (already exists)${os.EOL}`);
			} else {
				await fs.outputFile(destinationPath, file.content);
				this.ui.stdout.write(`Created ${relativePath}${os.EOL}`);
			}
		}
	}
};
