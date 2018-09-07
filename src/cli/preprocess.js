export default ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'preprocess', 'Preprocess a Wiring file (ino) into a C++ file (cpp)', {
		params: '<file>',
		options: {
			'saveTo': {
				description: 'Filename for the preprocessed file'
			}
		},
		handler: () => {
			const PreprocessCommand = require('../cmd/preprocess');
			return new PreprocessCommand().preprocess();
		},
		examples: {
			'$0 $command app.ino': 'Preprocess app.ino and save it to app.cpp',
			'$0 $command - --saveTo -': 'Preprocess from standard input and save output to standard output. Useful for scripts'
		}
	});
};
