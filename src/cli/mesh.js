function meshCommand() {
	if (!meshCommand._instance) {
		const MeshCommand = require('../cmd/mesh').MeshCommand;
		meshCommand._instance = new MeshCommand();
	}
	return meshCommand._instance;
}

export default ({ commandProcessor, root }) => {
	const mesh = commandProcessor.createCategory(root, 'mesh', 'Manage mesh networks');

	commandProcessor.createCommand(mesh, 'create', 'Create a new network', {
		params: '<name> <device>',
		options: {
			'password': {
				description: 'Network password'
			}
		},
		handler: (args) => {
			return meshCommand().create(args);
		}
	});

	commandProcessor.createCommand(mesh, 'remove', 'Remove network', {
		params: '<network> [device]',
		handler: (args) => {
			return meshCommand().remove(args);
		}
	});

	commandProcessor.createCommand(mesh, 'add', 'Add a device to a network', {
		params: '<joiner> <network> <commissioner>',
		handler: (args) => {
			return meshCommand().add(args);
		}
	});

	commandProcessor.createCommand(mesh, 'list', 'List networks', {
		params: '[network]',
		handler: (args) => {
			return meshCommand().list(args);
		}
	});

	return mesh;
};
