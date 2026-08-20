'use strict';
module.exports = ({ commandProcessor, root }) => {
	const project = commandProcessor.createCategory(root, 'project', 'Manage application projects');

	commandProcessor.createCommand(project, 'create', 'Create a new project in the current or specified directory', {
		options: {
			'name' : {
				description: 'provide a name for the project'
			},
			'ai': {
				description: 'also add AI assistant instruction files to the project',
				boolean: true
			}
		},
		params: '[dir]',
		handler: (...args) => require('./project_init').command(...args)
	});

	commandProcessor.createCommand(project, 'ai', 'Add AI assistant instruction files (AGENTS.md, CLAUDE.md, copilot-instructions.md) to a project', {
		params: '[dir]',
		handler: (args) => {
			const ProjectAICommand = require('../cmd/project-ai');
			return new ProjectAICommand().addAIFiles({ dir: args.params.dir });
		},
		examples: {
			'$0 $command': 'Add AI assistant instruction files to the project in the current directory',
			'$0 $command my_project': 'Add AI assistant instruction files to the project in the my_project directory'
		}
	});

	return project;
};
