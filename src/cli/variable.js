module.exports = ({ commandProcessor, root }) => {
	const variable = commandProcessor.createCategory(root, 'variable', 'Retrieve and monitor variables on your device');

	const timeOption = {
		'time': {
			boolean: true,
			description: 'Show the time when the variable was received'
		}
	};

	commandProcessor.createCommand(variable, 'list', 'Show variables provided by your device(s)', {
		handler: () => {
			const VariableCommand = require('../cmd/variable');
			return new VariableCommand().listVariables();
		}
	});

	commandProcessor.createCommand(variable, 'get', 'Retrieve a value from your device', {
		params: '[device] [variableName]',
		options: timeOption,
		handler: (args) => {
			const VariableCommand = require('../cmd/variable');
			return new VariableCommand().getValue(args.params.device, args.params.variableName, args);
		},
		examples: {
			'$0 $command basement temperature': 'Read the temperature variable from the device basement',
			'$0 $command all temperature': 'Read the temperature variable from all my devices',
		}
	});

	commandProcessor.createCommand(variable, 'monitor', 'Connect and display messages from a device', {
		params: '[device] [variableName]',
		options: Object.assign(timeOption, {
			'delay': {
				number: true,
				description: 'Interval in milliseconds between variable fetches',
				nargs: 1
			}
		}),
		handler: (args) => {
			const VariableCommand = require('../cmd/variable');
			return new VariableCommand().monitorVariables(args.params.device, args.params.variableName, args);
		},
		examples: {
			'$0 $command up temp --delay 2000': 'Read the temp variable from the device up every 2 seconds'
		}
	});

	return variable;
};

