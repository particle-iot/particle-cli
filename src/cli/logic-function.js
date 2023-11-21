module.exports = ({ commandProcessor, root }) => {
	const logic_function = commandProcessor.createCategory(root, 'logic-function', 'Create, execute, and deploy logic functions');

	commandProcessor.createCommand(logic_function, 'list', 'Lists the deployed logic functions', {
		options: {
			'org': {
				description: 'Specify the organization'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().list(args);
		}
	});

	commandProcessor.createCommand(logic_function, 'get', 'Downloads the logic function', {
		options: {
			'org': {
				description: 'Specify the organization'
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
		}
	});

	commandProcessor.createCommand(logic_function, 'create', 'Creates a logic function', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().create(args);
		}
	});

	commandProcessor.createCommand(logic_function, 'execute', 'Executes a logic function with user provided data', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			},
			'data': {
				description: 'Sample test data file to verify the logic function'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().execute(args);
		}
	});

	commandProcessor.createCommand(logic_function, 'deploy', 'Deploys a logic function to the cloud', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization'
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().deploy(args);
		}
	});

	commandProcessor.createCommand(logic_function, 'disable', 'Disables a logic function in the cloud', {
		options: {
			'org': {
				description: 'Specify the organization'
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
			return new LogicFunctionsCmd().disable(args);
		}
	});

	commandProcessor.createCommand(logic_function, 'delete', 'Deletes a logic function from the cloud', {
		options: {
			'org': {
				description: 'Specify the organization'
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
			return new LogicFunctionsCmd().delete(args);
		}
	});

	commandProcessor.createCommand(logic_function, 'logs', 'Deletes a logic function from the cloud', {
		options: {
			'org': {
				description: 'Specify the organization'
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
		}
	});

	return logic_function;
};
