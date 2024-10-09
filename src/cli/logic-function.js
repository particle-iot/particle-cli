const os = require('os');

module.exports = ({ commandProcessor, root }) => {
	const logicFunction = commandProcessor.createCategory(root, 'logic-function', 'Create, execute, and deploy Logic Functions', { alias : 'lf' });

	const aliasDescription = 'Alias: this command can be also executed as lf';
	commandProcessor.createCommand(logicFunction, 'list', `Lists the deployed Logic Functions. ${os.EOL}${aliasDescription} list [options]`, {
		options: {
			'org': {
				description: 'Specify the organization'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd(args).list(args);
		},
		examples: {
			'$0 $command': 'lists deployed Logic Functions',
		}
	});

	commandProcessor.createCommand(logicFunction, 'get', `Downloads the Logic Function. ${os.EOL}${aliasDescription} get [options]`, {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Name of the Logic Function'
			},
			'id': {
				description: 'Id of the Logic Function'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd(args).get(args);
		},
		examples: {
			'$0 $command': 'downloads a Logic Function to your current directory',
			'$0 $command --name <name>': 'downloads the Logic Function with the given name to your current directory',
			'$0 $command --id <id>': 'downloads the Logic Function with the given ID to your current directory',
		}
	});

	commandProcessor.createCommand(logicFunction, 'create', `Creates a Logic Function. ${os.EOL}${aliasDescription} create [options]`, {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Name of the Logic Function'
			},
			'description': {
				description: 'Description of the Logic Function'
			},
			'force': {
				boolean: true,
				default: false,
				description: 'Overwrites all the prompts',
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd(args).create(args);
		},
		examples: {
			'$0 $command': 'creates a new Logic Function',
			'$0 $command --name <name>': 'creates a new Logic Function with the given name'
		}
	});

	commandProcessor.createCommand(logicFunction, 'execute', `Executes a Logic Function with user provided data. ${os.EOL}${aliasDescription} execute [options]`, {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Name of the Logic Function'
			},
			'id': {
				description: 'Id of the Logic Function'
			},
			'data': {
				description: 'Sample test data file to verify the Logic Function'
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
			return new LogicFunctionsCmd(args).execute(args);
		},
		examples: {
			'$0 $command --data <data>': 'executes the local Logic Function with the data',
			'$0 $command --productId <productId>': 'executes the local Logic Function for an specific product',
			'$0 $command --deviceId <deviceId>': 'executes the local Logic Function for an specific device',
			'$0 $command --payload { "event": { "product_id": <productId>, "device_id": "<deviceId>", "event_data": "<test data>", "event_name":"<event_test_name>"}}' : 'executes the local Logic Function with the payload',
			'$0 $command --payload /path/payload.json' : 'executes the local Logic Function with the payload',
		}
	});

	commandProcessor.createCommand(logicFunction, 'deploy', `Deploys a Logic Function to the cloud. ${os.EOL}${aliasDescription} deploy [options]`, {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Name of the Logic Function'
			},
			'id': {
				description: 'Id of the Logic Function'
			},
			'data': {
				description: 'Sample test data file to verify the Logic Function'
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
			return new LogicFunctionsCmd(args).deploy(args);
		},
		examples: {
			'$0 $command --data <data>': 'executes and deploys the local Logic Function with the data',
			'$0 $command --productId <productId>': 'executes and deploys the local Logic Function for an specific product',
			'$0 $command --deviceId <deviceId>': 'executes and deploys the local Logic Function for an specific device',
			'$0 $command --payload { "event": { "product_id": <productId>, "device_id": "<deviceId>", "event_data": "<test data>", "event_name":"<event_test_name>"}}' : 'executes and deploys the local Logic Function with the payload',
			'$0 $command --payload /path/payload.json' : 'executes and deploys the local Logic Function with the payload',
		}
	});

	commandProcessor.createCommand(logicFunction, 'disable', `Disables a Logic Function in the cloud. ${os.EOL}${aliasDescription} disable [options]`, {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Name of the Logic Function'
			},
			'id': {
				description: 'Id of the Logic Function'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd(args).updateStatus(args, { enable: false });
		},
		examples: {
			'$0 $command': 'Disables a Logic Function',
			'$0 $command --name <name>': 'Disables a Logic Function with the given name',
			'$0 $command --id <id>': 'Disables a Logic Function with the given id',
		}
	});

	commandProcessor.createCommand(logicFunction, 'enable', `Enables a Logic Function in the cloud. ${os.EOL}${aliasDescription} enable [options]`, {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Name of the Logic Function'
			},
			'id': {
				description: 'Id of the Logic Function'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd(args).updateStatus(args, { enable: true });
		},
		examples: {
			'$0 $command': 'Enables a Logic Function',
			'$0 $command --name <name>': 'Enables a Logic Function with the given name',
			'$0 $command --id <id>': 'Enables a Logic Function with the given id',
		}
	});

	commandProcessor.createCommand(logicFunction, 'delete', `Deletes a Logic Function from the cloud. ${os.EOL}${aliasDescription} delete [options]`, {
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Name of the Logic Function'
			},
			'id': {
				description: 'Id of the Logic Function'
			},
			'force': {
				boolean: true,
				default: false,
				description: 'Overwrites all the prompts',
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd(args).delete(args);
		},
		examples: {
			'$0 $command': 'Deletes a Logic Function',
			'$0 $command --name <name>': 'Deletes a Logic Function with the given name',
			'$0 $command --id <id>': 'Deletes a Logic Function with the given id',
		}
	});

	commandProcessor.createCommand(logicFunction, 'logs', `Shows logs from a Logic Function. ${os.EOL}${aliasDescription} logs [options]`, {
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'name': {
				description: 'Name of the Logic Function'
			},
			'id': {
				description: 'Id of the Logic Function'
			},
			'saveTo': {
				description: 'File name to save the logs'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd(args).logs(args);
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
