

export default ({root, factory}) => {
	const project = factory.createCategory(root, 'project', 'Manages application projects');

	// todo - move library add to its own module
	factory.createCommand(project, 'init', 'Initialize a new project in the current or specified directory.', {
		options: {},
		params: '[dir]',
		handler: (...args) => factory.invoke(require('./project_init'), ...args)
	});

	return project;
};
