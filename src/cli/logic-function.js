module.exports = ({ commandProcessor, root }) => {
	const logicFunction = commandProcessor.createCategory(root, 'logic-function', 'Create, execute, and deploy logic functions', { alias : 'lf' });

	commandProcessor.createCommand(logicFunction, 'list', 'Lists the deployed logic functions', {
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().list(args);
		},
		examples: {
			'$0 $command': 'lists deployed Logic Functions'
		}
	});

	commandProcessor.createCommand(logicFunction, 'get', 'Downloads the logic function', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'name': {
				description: 'Name of the logic function'
			},
			'id': {
				description: 'Id of the logic function'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().get(args);
		},
		examples: {
			'$0 $command': 'downloads a Logic Function to your current directory',
			'$0 $command --name <name>': 'downloads the Logic Function with the given name to your current directory',
			'$0 $command --id <id>': 'downloads the Logic Function with the given ID to your current directory',
		}
	});

	commandProcessor.createCommand(logicFunction, 'create', 'Creates a logic function', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'name': {
				description: 'Name of the logic function'
			},
			'description': {
				description: 'Description of the logic function'
			},
			'force': {
				boolean: true,
				default: false,
				description: 'Overwrites all the prompts',
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().create(args);
		},
		examples: {
			'$0 $command': 'creates a new Logic Function',
			'$0 $command --name <name>': 'creates a new Logic Function with the given name'
		}
	});

	commandProcessor.createCommand(logicFunction, 'execute', 'Executes a logic function with user provided data', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'name': {
				description: 'Name of the logic function'
			},
			'id': {
				description: 'Id of the logic function'
			},
			'data': {
				description: 'Sample test data file to verify the logic function'
			},
			'event_name': {
				description: 'Name of the event to execute'
			},
			'product_id': {
				description: 'Product ID of the device'
			},
			'device_id': {
				description: 'Device ID of the device'
			},
			'payload': {
				description: 'Payload to send to the device could be a string or a file path'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().execute(args);
		},
		examples: {
			'$0 $command --data <data>': 'executes the local Logic Function with the data',
			'$0 $command --productId <productId>': 'executes the local Logic Function for an specific product',
			'$0 $command --deviceId <deviceId>': 'executes the local Logic Function for an specific device',
			'$0 $command --payload { "event": { "product_id": <productId>, "device_id": "<deviceId>", "event_data": "<test data>", "event_name":"<event_test_name>"}}' : 'executes the local Logic Function with the payload',
			'$0 $command --payload /path/payload.json' : 'executes the local Logic Function with the payload',
		}
	});

	commandProcessor.createCommand(logicFunction, 'deploy', 'Deploys a logic function to the cloud', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'name': {
				description: 'Name of the logic function'
			},
			'id': {
				description: 'Id of the logic function'
			},
			'data': {
				description: 'Sample test data file to verify the logic function'
			},
			'event_name': {
				description: 'Name of the event to execute'
			},
			'product_id': {
				description: 'Product ID of the device'
			},
			'device_id': {
				description: 'Device ID of the device'
			},
			'payload': {
				description: 'Payload to send to the device could be a string or a file path'
			},
			'force': {
				boolean: true,
				default: false,
				description: 'Overwrites all the prompts',
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().deploy(args);
		},
		examples: {
			'$0 $command --data <data>': 'executes and deploys the local Logic Function with the data',
			'$0 $command --productId <productId>': 'executes and deploys the local Logic Function for an specific product',
			'$0 $command --deviceId <deviceId>': 'executes and deploys the local Logic Function for an specific device',
			'$0 $command --payload { "event": { "product_id": <productId>, "device_id": "<deviceId>", "event_data": "<test data>", "event_name":"<event_test_name>"}}' : 'executes and deploys the local Logic Function with the payload',
			'$0 $command --payload /path/payload.json' : 'executes and deploys the local Logic Function with the payload',
		}
	});

	commandProcessor.createCommand(logicFunction, 'disable', 'Disables a logic function in the cloud', {
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'name': {
				description: 'Name of the logic function'
			},
			'id': {
				description: 'Id of the logic function'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().updateStatus(args, { enable: false });
		},
		examples: {
			'$0 $command': 'Disables a Logic Function',
			'$0 $command --name <name>': 'Disables a Logic Function with the given name',
			'$0 $command --id <id>': 'Disables a Logic Function with the given id',
		}
	});

	commandProcessor.createCommand(logicFunction, 'enable', 'Enables a logic function in the cloud', {
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'name': {
				description: 'Name of the logic function'
			},
			'id': {
				description: 'Id of the logic function'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().updateStatus(args, { enable: true });
		},
		examples: {
			'$0 $command': 'Enables a Logic Function',
			'$0 $command --name <name>': 'Enables a Logic Function with the given name',
			'$0 $command --id <id>': 'Enables a Logic Function with the given id',
		}
	});

	commandProcessor.createCommand(logicFunction, 'delete', 'Deletes a logic function from the cloud', {
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'name': {
				description: 'Name of the logic function'
			},
			'id': {
				description: 'Id of the logic function'
			},
			'force': {
				boolean: true,
				default: false,
				description: 'Overwrites all the prompts',
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().delete(args);
		},
		examples: {
			'$0 $command': 'Deletes a Logic Function',
			'$0 $command --name <name>': 'Deletes a Logic Function with the given name',
			'$0 $command --id <id>': 'Deletes a Logic Function with the given id',
		}
	});

	commandProcessor.createCommand(logicFunction, 'logs', 'Shows logs from a Logic Function', {
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'name': {
				description: 'Name of the logic function'
			},
			'id': {
				description: 'Id of the logic function'
			},
			'saveTo': {
				description: 'File name to save the logs'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().logs(args);
		},
		examples: {
			'$0 $command': 'Shows logs from a Logic Function',
			'$0 $command --name <name>': 'Shows logs from a Logic Function with the given name',
			'$0 $command --id <id>': 'Shows logs from a Logic Function with the given id',
			'$0 $command --name <name> --saveTo /path/to/file.txt': 'Downloads logs from a Logic Function with the given name to the path',
		}
	});

	return logicFunction;
};
