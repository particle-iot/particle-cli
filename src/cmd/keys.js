export default (app, cli) => {
	const keys = cli.createCategory(app, 'keys', 'Manage your device\'s keypair and server public key');
	cli.createCommand(keys, 'save', 'Save your keys', {
		params: '<filename>',
		options: {
			'force': {
				boolean: true,
				default: false,
				description: 'Force overwriting of <filename> if it exists'
			}
		},
		handler: (argv) => {
			console.log(argv);
		}
	});
};
