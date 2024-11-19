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
                description: 'Provide the output json file path'
            },
            'bulk': {
                description: 'Provision multiple devices'
            }
		}),
		handler: (args) => {
            const eSimCommands = require('../cmd/esim');
			if (args.bulk) {
                return new eSimCommands().bulkProvisionCommand(args);
            } else {
                return new eSimCommands().provisionCommand(args);
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
	return esim;
};

