/**
 * A simple command to echo the passed in options and parameters.
 */

export default ({root, factory}) => {
	factory.createCommand(root, 'echo', false, {
		options: {
			f: {
				alias: 'flag',
				boolean: true,
				description: 'an option'
			}
		},
		params: '[args...]',
		handler: function echoHandler(argv) {
			const obj = {
				cmd: argv._,
				flag: argv.flag,
				params: argv.params
			};
			console.log(JSON.stringify(obj));
		}
	});
};
