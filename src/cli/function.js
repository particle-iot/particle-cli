module.exports = ({ commandProcessor, root }) => {
	const func = commandProcessor.createCategory(root, 'function', 'Call functions on your device');

	commandProcessor.createCommand(func, 'list', 'Show functions provided by your device(s)', {
		handler: () => {
			const FunctionCommand = require('../cmd/function');
			return new FunctionCommand().listFunctions();
		}
	});

	commandProcessor.createCommand(func, 'call', 'Call a particular function on a device', {
		params: '<device> <function> [argument]',
		options: {
			'product': {
				description: 'Target a device within the given Product ID or Slug'
			}
		},
		handler: (args) => {
			const FunctionCommand = require('../cmd/function');
			return new FunctionCommand().callFunction(args);

		},
		examples: {
			'$0 $command coffee brew': 'Call the brew function on the coffee device',
			'$0 $command board digitalWrite D7=HIGH': 'Call the digitalWrite function with argument D7=HIGH on the board device',
			'$0 $command coffee brew --product 12345': 'Call the brew function on the coffee device within product 12345'
		}
	});

	return func;
};
