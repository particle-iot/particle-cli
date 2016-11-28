import {LibraryListCommand, LibraryListCommandSite} from '../cmd';
import {convertApiError} from '../cmd/api';
import {spin} from '../app/ui';
import {buildAPIClient} from './apiclient';
import chalk from 'chalk';


export class CLILibraryListCommandSite extends LibraryListCommandSite {

	constructor(argv, apiClient) {
		super();
		this._apiClient = apiClient;
		this.argv = argv;
		if (!argv.sections || !argv.sections.length) {
			argv.sections = ['official', 'verified', 'popular', 'mine', 'recent'];
		}
		// todo - since the text can be used by any app, this could be pushed down to the command layer so it's shared
		this.headings = {
			official: 'Official Libraries',
			verified: 'Verified Libraries',
			popular: 'Popular Libraries',
			mine: 'My Libraries',
			recent: 'Recently added/updated Libraries'
		}
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
	 * @returns {{}}
	 */
	settings() {
		return {};
	}

	sections() {
		const result = {};
		const sections = this.argv.sections;
		for (let section of sections) {
			result[section] = {};
		}
		return result;
	}

	notifyFetchLists(promise) {
		return spin(promise, `Searching for libraries...`)
			.then((results) => {
				const sections = this.argv.sections;
				let separator = false;
				for (let index in sections) {
					const name = sections[index];
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
				this.printLibrary(name, library);
			}
		}
		else {
			console.log(chalk.grey('   No libraries to show in this section.'));
		}
	}

	printLibrary(section, library) {
		console.log(chalk.blue(library.name)+' '+chalk.grey(library.version));
		let badges = [];
		if (library.verified) {
			badges.push(chalk.green('[verified] '));
		}
		if (library.visibility==='private') {
			badges.push(chalk.blue('[private] '));
		}
		const badgesText = badges.join('');
		const defaultSentence = 'no description given';
		console.log(`   ${badgesText}${library.sentence || defaultSentence}`);
	}
}

export default ({lib, factory, apiJS}) => {
	factory.createCommand(lib, 'list', 'Lists libraries available', {
		options: {},
		params: '[sections]',
		handler: function libraryListHandler(argv) {
			const site = new CLILibraryListCommandSite(argv, buildAPIClient(apiJS));
			const cmd = new LibraryListCommand();
			return site.run(cmd);
		}
	});
};
