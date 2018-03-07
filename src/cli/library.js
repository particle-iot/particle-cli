
function api() {

	const ParticleApi = require('../cmd/api').default;
	const settings = require('../../settings');

	if (!api._instance) {
		api._instance = new ParticleApi(settings.apiUrl, {
			accessToken: settings.access_token
		}).api;
	}
	return api._instance;
}

export default ({ commandProcessor, root }) => {
	const lib = commandProcessor.createCategory(root, 'library', 'Manages firmware libraries', { alias: 'libraries' });

	commandProcessor.createCommand(lib, 'add', 'Adds a library to the current project.', {
		options: {},
		params: '<name>',
		handler: (...args) => require('./library_add').command(api(), ...args),
		examples: {
			'$0 $command InternetButton': 'Add the InternetButton library to your project. Create a project with the project init command'
		}
	});

	commandProcessor.createCommand(lib, 'create', 'Creates a new library in the specified or current directory.', {
		options: {
			'name': {
				required: false,
				description: 'The name of the library to create.'
			},
			'version': {
				required: false,
				description: 'The initial version of the library to create.'
			},
			'author': {
				required: false,
				description: 'The author of the library.'
			}
		},
		handler: (...args) => require('./library_init').command(...args)
	});

	commandProcessor.createCommand(lib, 'install', false, {
		options: {
			'copy': {
				required: false,
				boolean: true,
				alias: 'vendored',
				description: 'install the library by copying the library sources into the project\'s lib folder.'
			},
			'adapter': {        // hidden
				required: false,
				boolean: true,
				alias: 'a'
			},
			'confirm': {
				required: false,
				boolean: true,
				alias: 'y'
			},
			'dest': {
				required: false,
				boolean: false,
				description: 'the directory to install to'
			}
		},
		params: '[name]',
		handler: (...args) => require('./library_install').command('install', api(), ...args),
	});

	commandProcessor.createCommand(lib, 'copy', 'Copies a library to the current project.', {
		options: {},
		params: '[name]',
		handler: (...args) => require('./library_install').command('copy', api(), ...args)
	});

	commandProcessor.createCommand(lib, 'list', 'Lists libraries available.', {
		options: {
			'filter': {
				required: false,
				string: true,
				description: 'filters libraries not matching the text'
			},
			'non-interactive': {
				required: false,
				boolean: true,
				description: 'Prints a single page of libraries without prompting'
			},
			'page': {
				required: false,
				description: 'Start the listing at the given page number'
			},
			'limit': {
				required: false,
				description: 'The number of items to show per page'
			}
		},
		params: '[sections...]',
		handler: (...args) => require('./library_list').command(api(), ...args)
	});

	commandProcessor.createCommand(lib, 'migrate', 'Migrates a local library from v1 to v2 format.', {
		options: {
			test: {
				alias: 'dryrun',
				boolean: true,
				description: 'test if the library can be migrated'
			},
			'adapter': {
				required: false,
				boolean: true,
				default: true,
				description: 'add include file adapters to support v1-style includes "library/library.h"'
			},
		},
		params: '[library...]',

		handler: (...args) => require('./library_migrate').command(...args)
	});

	commandProcessor.createCommand(lib, 'search', 'Searches available libraries.', {
		options: {
		},
		params: '<name>',
		handler: (...args) => require('./library_search').command(api(), ...args)
	});

	commandProcessor.createCommand(lib, 'upload', 'Uploads a private version of a library.', {
		options: {
			'dryRun': {
				required: false,
				boolean: true,
				description: 'perform validation steps but don\'t actually upload the library.'
			}
		},
		handler: (...args) => require('./library_upload').command(api(), ...args)
	});

	commandProcessor.createCommand(lib, 'publish', 'Publishes a private library, making it public.', {
		options: {},
		params: '[name]',
		handler: (...args) => require('./library_publish').command(api(), ...args)
	});

	commandProcessor.createCommand(lib, 'view', 'View details about a library', {
		options: {
			'readme': {
				required: false,
				boolean: true,
				description: 'display the readme for the library'
			},
			'source': {
				required: false,
				boolean: true,
				description: 'display the main source file for the library'
			},
			'header': {
				required: false,
				boolean: true,
				description: 'display the main header file for the library'
			}

		},
		params: '<name>',
		handler: (...args) => require('./library_view').command(api(), ...args)
	});

	commandProcessor.createCommand(lib, 'delete', false, {
		options: {},
		params: '<name>',
		handler: (...args) => require('./library_delete').command(api(), ...args)
	});

	return lib;
};
