'use strict';

module.exports = ({ commandProcessor, root }) => {
	const org = commandProcessor.createCategory(root, 'org', 'Access Particle organization functionality');
	const exportCmd = commandProcessor.createCategory(org, 'export', 'Export organization data');

	commandProcessor.createCommand(exportCmd, 'devices', 'Export all devices from an organization', {
		params: '<org>',
		options: {
			format: {
				alias: 'f',
				description: 'Output format: csv or json',
				default: 'csv'
			},
			product: {
				alias: 'p',
				description: 'Filter by product IDs (comma-separated)'
			},
			group: {
				alias: 'g',
				description: 'Filter by group names (comma-separated)'
			},
			output: {
				alias: 'o',
				description: 'Output file path (stdout by default)'
			}
		},
		examples: {
			'$0 $command my-org': 'Export all devices from organization `my-org` as CSV to stdout',
			'$0 $command my-org --format json': 'Export all devices as JSON',
			'$0 $command my-org --product 12345': 'Export devices from product `12345` only',
			'$0 $command my-org --group production': 'Export devices in the `production` group',
			'$0 $command my-org -p 12345,67890 -g production,staging': 'Export devices matching multiple filters',
			'$0 $command my-org -o devices.csv': 'Export devices to a file'
		},
		handler: (args) => {
			const OrgCmd = require('../cmd/org');
			return new OrgCmd(args).exportDevices(args);
		}
	});

	return org;
};
