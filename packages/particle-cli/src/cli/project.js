module.exports = ({ commandProcessor, root }) => {
	const project = commandProcessor.createCategory(root, 'project', 'Manage application projects');

	commandProcessor.createCommand(project, 'create', 'Create a new project in the current or specified directory', {
		options: {
			'name' : {
				description: 'provide a name for the project'
			}
		},
		params: '[dir]',
		handler: (...args) => require('./project_init').command(...args)
	});

	return project;
};
