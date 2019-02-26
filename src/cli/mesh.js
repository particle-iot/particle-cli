import settings from '../../settings';

function meshCommand() {
	if (!meshCommand._instance) {
		const MeshCommand = require('../cmd/mesh').MeshCommand;
		meshCommand._instance = new MeshCommand(settings);
	}
	return meshCommand._instance;
}

export default ({ commandProcessor, root }) => {
	const mesh = commandProcessor.createCategory(root, 'mesh', 'Manage mesh networks');

	commandProcessor.createCommand(mesh, 'create', 'Create a new network', {
		// TODO: Provide descriptions for positional arguments?
		params: '<network_name> <device>',
		options: {
			'password': {
				description: 'Network password. The minimum password length is 6 characters',
				string: true,
			},
			'channel': {
				description: 'Network channel. By default, the device will try to pick the least congested channel in your environment',
				number: true
			},
			'yes': {
				description: 'Answer yes to all questions',
				boolean: true,
				alias: 'y'
			}
		},
		handler: (args) => {
			return meshCommand().create(args);
		}
	});

	commandProcessor.createCommand(mesh, 'add', 'Add a device to a network', {
		params: '<new_device> <assisting_device>',
		options: {
			'password': {
				description: 'Network password',
				string: true,
			},
			'yes': {
				description: 'Answer yes to all questions',
				boolean: true,
				alias: 'y'
			}
		},
		handler: (args) => {
			return meshCommand().add(args);
		}
	});

	commandProcessor.createCommand(mesh, 'remove', 'Remove a device from its network', {
		params: '<device>',
		options: {
			'yes': {
				description: 'Answer yes to all questions',
				boolean: true,
				alias: 'y'
			}
		},
		handler: (args) => {
			return meshCommand().remove(args);
		}
	});

	commandProcessor.createCommand(mesh, 'list', 'List networks and their member devices', {
		params: '[network]',
		options: {
			'networks-only': {
				description: 'Do not list member devices',
				boolean: true,
				alias: 'n'
			}
		},
		handler: (args) => {
			return meshCommand().list(args);
		}
	});

	commandProcessor.createCommand(mesh, 'info', 'Get information about the current device\'s network', {
		params: '<device>',
		handler: (args) => {
			return meshCommand().info(args);
		}
	});

	commandProcessor.createCommand(mesh, 'scan', 'Scan for networks', {
		params: '<device>',
		handler: (args) => {
			return meshCommand().scan(args);
		}
	});

	return mesh;
};
