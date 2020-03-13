module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'preprocess', 'Preprocess a Wiring file (ino) into a C++ file (cpp)', {
		params: '<file>',
		options: {
			'name': {
				description: 'Filename and path to include in the preprocessed file. Default to the input file name'
			},
			'saveTo': {
				description: 'Filename for the preprocessed file'
			}
		},
		handler: (args) => {
			const PreprocessCommand = require('../cmd/preprocess');
			return new PreprocessCommand().preprocess(args.params.file, args);
		},
		examples: {
			'$0 $command app.ino': 'Preprocess app.ino and save it to app.cpp',
			'$0 $command - --name app.ino --saveTo -': 'Preprocess from standard input and save output to standard output. Useful for scripts'
		}
	});
};
