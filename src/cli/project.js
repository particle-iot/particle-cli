

export default ({ root, factory }) => {
	const project = factory.createCategory(root, 'project', 'Manages application projects');

	factory.createCommand(project, 'create', 'Create a new project in the current or specified directory.', {
		options: {
			'name' : {
				required: false,
				description: 'provide a name for the project'
			}
		},
		params: '[dir]',
		handler: (...args) => factory.invoke(require('./project_init'), ...args)
	});

	return project;
};
