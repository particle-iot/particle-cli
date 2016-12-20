import {LibraryListCommand, LibraryListCommandSite} from '../cmd';
import {convertApiError} from '../cmd/api';
import {spin} from '../app/ui';
import {buildAPIClient} from './apiclient';
import chalk from 'chalk';
import {formatLibrary} from './library_ui.js';

export class CLILibraryListCommandSite extends LibraryListCommandSite {

	constructor(argv, apiClient) {
		super();
		this._apiClient = apiClient;
		this.argv = argv;
		let sections = argv.params.sections;
		if (!sections || !sections.length) {
			sections = ['mine', 'community'];
		}
		this._sections = sections;
		// todo - since the text can be used by any app, this could be pushed down to the command layer so it's shared
		this.headings = {
			official: 'Official Libraries',
			verified: 'Verified Libraries',
			popular: 'Popular Libraries',
			mine: 'My Libraries',
			recent: 'Recently added/updated Libraries',
			community: 'Community Libraries'
		};
	}

	apiClient() {
		return this._apiClient;
	}

	error(error) {
		throw convertApiError(error);
	}

	target() {
		return {};
	}

	/**
	 * Use the default settings
	 * @returns {Object} Empty object {}
	 */
	settings() {
		const result = {};
		if (this.argv.filter) {
			result.filter = this.argv.filter;
		}
		return result;
	}

	sectionNames() {
		return this._sections;
	}

	sections() {
		const result = {};
		const sections = this.sectionNames();
		for (let section of sections) {
			result[section] = {};
		}
		if (result.mine) {
			result.mine.excludeBadges = {mine:true};
		}
		return result;
	}

	notifyFetchLists(promise) {
		return spin(promise, 'Searching for libraries...')
			.then((results) => {
				const sections = this.sectionNames();
				let separator = false;
				for (let name of sections) {
					const list = results[name];
					if (list) {
						if (separator) {
							console.log();
						}
						this.printSection(name, list);
						separator = true;
					}
				}
			});
	}

	printSection(name, libraries) {
		const heading = this.headings[name] || name;
		console.log(chalk.bold(heading));
		if (libraries.length) {
			for (let library of libraries) {
				this.showLibrary(name, library);
			}
		} else {
			console.log(chalk.grey('No libraries to show in this section.'));
		}
	}

	showLibrary(section, library) {
		console.log(formatLibrary(library, section.excludeBadges));
	}
}

export default ({lib, factory, apiJS}) => {
	factory.createCommand(lib, 'list', 'Lists libraries available', {
		options: {
			'filter': {
				required: false,
				string: true,
				description: 'filter out libraries not matching the text'
			}
		},
		params: '[sections...]',
		handler: function libraryListHandler(argv) {
			const site = new CLILibraryListCommandSite(argv, buildAPIClient(apiJS));
			const cmd = new LibraryListCommand();
			return site.run(cmd);
		}
	});
};
