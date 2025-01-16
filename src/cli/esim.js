const unindent = require('../lib/unindent');

module.exports = ({ commandProcessor, root }) => {
	const esim = commandProcessor.createCategory(root, 'esim', 'Download eSIM profiles (INTERNAL ONLY)');

	commandProcessor.createCommand(esim, 'provision', 'Provisions eSIM profiles on a device', {
		options: Object.assign({
			'lpa': {
				description: 'Provide the LPA tool path'
			},
			'input': {
				description: 'Provide the input json file path'
			},
			'output': {
				description: 'Provide the output folder path'
			},
			'binary': {
				description: 'Provide the path to the binaries'
			},
			'bulk': {
				description: 'Provision multiple devices'
			}
		}),
		handler: (args) => {
			const ESimCommands = require('../cmd/esim');
			if (args.bulk) {
				return new ESimCommands().bulkProvisionCommand(args);
			} else {
				return new ESimCommands().provisionCommand(args);
			}
		},
		examples: {
			'$0 $command': 'TBD'
		},
		epilogue: unindent(`
			The JSON file should look like this:
			{
			  "TBD": "TBD"
			}
			
			TBD TBD
		`)
	});

	commandProcessor.createCommand(esim, 'enable', 'Enables a downloaded eSIM profile', {
		handler: (args) => {
			const ESimCommands = require('../cmd/esim');
			return new ESimCommands().enableCommand();
		},
		examples: {
			'$0 $command': 'TBD'
		}
	});
	return esim;
};

