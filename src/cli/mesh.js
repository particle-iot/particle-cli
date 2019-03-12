const settings = require('../../settings');

function meshCommand() {
	if (!meshCommand._instance) {
		const MeshCommand = require('../cmd/mesh');
		meshCommand._instance = new MeshCommand(settings);
	}
	return meshCommand._instance;
}

module.exports = ({ commandProcessor, root }) => {
	const mesh = commandProcessor.createCategory(root, 'mesh', 'Manage mesh networks');

	commandProcessor.createCommand(mesh, 'create', 'Create a new network', {
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
		examples: {
			'$0 $command my_network my_argon': 'Create a network named "my_network" using a device named "my_argon"'
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
		examples: {
			'$0 $command my_xenon my_argon': 'Add a device named "my_xenon" to the current network of a device named "my_argon"'
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
		examples: {
			'$0 $command my_xenon': 'Remove a device named "my_xenon" from its current network'
		},
		handler: (args) => {
			return meshCommand().remove(args);
		}
	});

	commandProcessor.createCommand(mesh, 'list', 'List all networks and their member devices', {
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
