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
		}
	});

	commandProcessor.createCommand(logicFunction, 'get', 'Downloads the logic function', {
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
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().create(args);
		}
	});

	commandProcessor.createCommand(logicFunction, 'execute', 'Executes a logic function with user provided data', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'data': {
				description: 'Sample test data file to verify the logic function'
			},
			'dataPath': {
				description: 'Sample test data file to verify the logic function'
			},
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().execute(args);
		}
	});

	commandProcessor.createCommand(logicFunction, 'deploy', 'Deploys a logic function to the cloud', {
		params: '[filepath]',
		options: {
			'org': {
				description: 'Specify the organization',
				hidden: true
			},
			'data': {
				description: 'Sample test data file to verify the logic function'
			},
			'dataPath': {
				description: 'Sample test data file to verify the logic function'
			},
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().deploy(args);
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
			}
		},
		handler: (args) => {
			const LogicFunctionsCmd = require('../cmd/logic-function');
			return new LogicFunctionsCmd().delete(args);
		}
	});

	commandProcessor.createCommand(logicFunction, 'logs', 'Deletes a logic function from the cloud', {
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
		}
	});

	return logicFunction;
};
