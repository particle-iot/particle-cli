
import {api} from './apiclient';

export default ({ root, factory }) => {
	const lib = factory.createCategory(root, 'library', 'Manages firmware libraries', { alias: 'libraries' });

	factory.createCommand(lib, 'add', 'Adds a library to the current project.', {
		options: {},
		params: '<name>',
		handler: (...args) => factory.invoke(require('./library_add'), api(), ...args)
	});

	factory.createCommand(lib, 'create', 'Creates a new library in the specified or current directory.', {
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
		handler: (...args) => factory.invoke(require('./library_init'), ...args)
	});

	factory.createCommand(lib, 'install', false, {
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
		handler: (...args) => factory.invoke(require('./library_install'), 'install', api(), ...args),
	});

	factory.createCommand(lib, 'copy', 'Copies a library to the current project.', {
		options: {},
		params: '[name]',
		handler: (...args) => factory.invoke(require('./library_install'), 'copy', api(), ...args)
	});

	factory.createCommand(lib, 'list', 'Lists libraries available.', {
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
		handler: (...args) => factory.invoke(require('./library_list'), api(), ...args)
	});

	factory.createCommand(lib, 'migrate', 'Migrates a local library from v1 to v2 format.', {
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

		handler: (...args) => factory.invoke(require('./library_migrate'), ...args)
	});

	factory.createCommand(lib, 'search', 'Searches available libraries.', {
		options: {
		},
		params: '<name>',
		handler: (...args) => factory.invoke(require('./library_search'),api(), ...args)
	});

	factory.createCommand(lib, 'upload', 'Uploads a private version of a library.', {
		options: {
			'dryRun': {
				required: false,
				boolean: true,
				description: 'perform validation steps but don\'t actually upload the library.'
			}
		},
		handler: (...args) => factory.invoke(require('./library_upload'), api(), ...args)
	});

	factory.createCommand(lib, 'publish', 'Publishes a private library, making it public.', {
		options: {},
		params: '[name]',
		handler: (...args) => factory.invoke(require('./library_publish'), api(), ...args)
	});

	factory.createCommand(lib, 'view', 'View details about a library', {
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
		handler: (...args) => factory.invoke(require('./library_view'), api(), ...args)
	});

	factory.createCommand(lib, 'delete', false, {
		options: {},
		params: '<name>',
		handler: (...args) => factory.invoke(require('./library_delete'), api(), ...args)
	});

	return lib;
};
