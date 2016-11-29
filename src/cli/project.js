
import projectInit from './project_init';


export default ({root, factory}) => {
	const project = factory.createCategory(root, 'project', 'Manages application projects');
	projectInit({root, project, factory});
	return project;
};
