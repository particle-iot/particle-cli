const chalk = require('chalk');
const { spin } = require('../app/ui');
const prompt = require('../lib/prompts');
const { convertApiError } = require('../cmd/api');
const { buildAPIClient } = require('./apiclient');
const { formatLibrary } = require('./library_ui');
const { LibraryListCommand, LibraryListCommandSite } = require('../cmd');


class CLILibraryListCommandSite extends LibraryListCommandSite {
	constructor(argv, apiClient) {
		super();
		this._apiClient = apiClient;
		this.argv = argv;
		let sections = argv.params.sections;
		if (!sections || !sections.length) {
			sections = ['mine', 'community'];
		}
		this._sectionNames = sections;
		this._page = this.argv.page || 1;

		// todo - since the text can be used by any app, this could be pushed down to the command layer so it's shared
		this.headings = {
			official: 'Official Libraries',
			verified: 'Verified Libraries',
			popular: 'Popular Libraries',
			mine: 'My Libraries',
			recent: 'Recently added/updated Libraries',
			community: 'Community Libraries'
		};

		this._sections = this._buildSections();
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
		this._add(result, 'filter');
		this._add(result, 'limit');
		return result;
	}

	_add(target, param) {
		if (this.argv[param]) {
			target[param] = this.argv[param];
		}
	}

	sectionNames() {
		return this._sectionNames;
	}

	sections() {
		return this._sections;
	}

	_buildSections() {
		const result = {};
		const sections = this.sectionNames();
		for (let section of sections) {
			result[section] = { page:1 };
		}
		if (result.mine) {
			result.mine.excludeBadges = { mine:true };
		}
		return result;
	}

	_nextPage() {
		this._page++;
		for (let name of this.sectionNames()) {
			const section = this._sections[name];
			section.page += 1;
		}
	}

	_removeEmptySections(results, sectionNames = this._sectionNames, sections = this._sections) {
		for (let name of sectionNames) {
			const section = results[name];
			if (!section || !section.length) {
				this._removeSection(name, sectionNames, sections);
			}
		}
		return [sectionNames, sections];
	}

	_removeSection(name, sectionNames=this._sectionNames, sections=this._sections) {
		sectionNames.splice(sectionNames.indexOf(name), 1);
		delete sections[name];
	}

	notifyFetchLists(promise) {
		const msg = this._page === 1 ? 'Searching for libraries...' : `Retrieving libraries page ${this._page}`;
		return spin(promise, msg)
			.then((results) => {
				const sections = this.sectionNames();
				let separator = false;
				for (let name of sections) {
					const list = results[name];
					if (list) {
						if (separator) {
							console.log();
						}
						this.printSection(name, this._sections[name], list);
						separator = true;
					}
				}
				return results;
			});
	}

	printSection(name, section, libraries) {
		// omit the section if not on the first page and there are no results
		if (!libraries.length && section.page) {
			return;
		}

		const page = section.page>1 ? chalk.grey(` page ${section.page}`) : '';
		const heading = this.headings[name] || name;
		console.log(chalk.bold(heading)+page);
		if (libraries.length) {
			for (let library of libraries) {
				this.showLibrary(section, library);
			}
		} else {
			console.log(chalk.grey('No libraries to show in this section.'));
		}
	}

	showLibrary(section, library) {
		console.log(formatLibrary(library, section.excludeBadges));
	}
}


module.exports.CLILibraryListCommandSite = CLILibraryListCommandSite;
module.exports.command = (apiJS, argv) => {
	const site = new CLILibraryListCommandSite(argv, buildAPIClient(apiJS));
	const cmd = new LibraryListCommand();

	function prompForNextPage() {
		return prompt.enterToContinueControlCToExit();
	}

	function runPage() {
		return site.run(cmd).then((results) => nextPage(results));
	}

	function nextPage(results) {
		if (results) {
			// only continue to show sections with results;
			const [names,] = site._removeEmptySections(results);
			if (!argv['non-interactive'] && names.length) {
				site._nextPage();
				return prompForNextPage()
					.then(next => {
						if (next) {
							return runPage();
						}
					});
			}
		}
	}

	return runPage();
};

