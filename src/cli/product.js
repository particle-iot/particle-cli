module.exports = ({ commandProcessor, root }) => {
	const product = commandProcessor.createCategory(root, 'product', 'Access Particle Product functionality');
	const device = commandProcessor.createCategory(product, 'device', 'Manage the devices associated with your product');

	commandProcessor.createCommand(device, 'list', 'List all devices that are part of a product', {
		params: '<product> [device]',
		options: {
			name: {
				alias: 'n',
				description: 'Filter to devices with this name (partial matching)'
			},
			page: {
				alias: 'p',
				number: true,
				description: 'Start listing at the given page number'
			},
			limit: {
				alias: 'l',
				number: true,
				description: 'The number of items to show per page'
			},
			groups: {
				alias: 'g',
				array: true,
				description: 'Space separated list of groups to include'
			},
			json: {
				boolean: true,
				description: 'Output JSON formatted data (experimental)'
			}
		},
		examples: {
			'$0 $command 12345': 'Lists devices in Product 12345',
			'$0 $command 12345 5a8ef38cb85f8720edce631a': 'Get details for device 5a8ef38cb85f8720edce631a within in product 12345',
			'$0 $command 12345 --groups foo bar': 'Lists devices in Product which are assigned the `foo` or `bar` groups'
		},
		handler: (args) => {
			const ProdCmd = require('../cmd/product');
			return new ProdCmd().showDeviceList(args);
		}
	});

	commandProcessor.createCommand(device, 'add', 'Adds one or more devices into a Product', {
		params: '<product> [device]',
		options: {
			file: {
				alias: 'f',
				description: 'Path to single column .txt file with list of IDs, S/Ns, IMEIs, or ICCIDs of the devices to add'
			}
		},
		examples: {
			'$0 $command 12345 5a8ef38cb85f8720edce631a': 'Add device id 5a8ef38cb85f8720edce631a into product 12345',
			'$0 $command 12345 --file ./path/to/device_ids.txt': 'Adds a list of devices into product 12345',
		},
		handler: (args) => {
			const ProdCmd = require('../cmd/product');
			return new ProdCmd().addDevices(args);
		}
	});

	return product;
};
