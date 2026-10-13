'use strict';
const path = require('path');
const fs = require('fs-extra');
const settings = require('../../../settings');
const utilities = require('../utilities');
const UI = require('../ui');
const { LibraryInstallCommand } = require('../../cmd');
const { CLILibraryInstallCommandSite } = require('../../cli/library_install');

const DEPENDENCY_PREFIX = 'dependencies.';

/**
 * The cloud compiler resolves `dependencies.*` from project.properties itself; `make`
 * cannot. Before a local compile the missing ones are copied into `lib/`, exactly what
 * `particle library install --vendored` does, and only for libraries not there yet.
 */

/** @returns {Promise<Array<{ name: string, version: string }>>} every dependency the project declares */
async function readDependencies(projectDir) {
	let props;
	try {
		props = await utilities.parsePropertyFile(path.join(projectDir, 'project.properties'));
	} catch (_error) {
		return [];
	}
	const dependencies = [];
	for (const [key, version] of Object.entries(props)) {
		if (key.startsWith(DEPENDENCY_PREFIX) && key.length > DEPENDENCY_PREFIX.length) {
			dependencies.push({ name: key.slice(DEPENDENCY_PREFIX.length), version: `${version}`.trim() });
		}
	}
	return dependencies;
}

/** A vendored library is `lib/<name>/library.properties`. */
async function missingDependencies(projectDir) {
	const dependencies = await readDependencies(projectDir);
	const missing = [];
	for (const dependency of dependencies) {
		if (!await fs.pathExists(path.join(projectDir, 'lib', dependency.name, 'library.properties'))) {
			missing.push(dependency);
		}
	}
	return missing;
}

class VendorSite extends CLILibraryInstallCommandSite {
	constructor({ dependency, projectDir, apiClient, ui }) {
		const argv = { vendored: true, adapter: false, params: { name: `${dependency.name}@${dependency.version}` } };
		super(argv, projectDir, apiClient);
		this.ui = ui;
	}

	async notifyCheckingLibrary() {
		// the fetching notice below says everything the user needs
	}

	async notifyFetchingLibrary(lib, targetDir) {
		if (!this.ui.quiet) {
			this.ui.write(`Installing library ${lib.name} ${lib.version} to ${targetDir} ...`);
		}
	}

	async notifyInstalledLibrary() {
		// covered by the fetching notice
	}
}

/**
 * Vendors every declared dependency that is not in `lib/` yet.
 * @param {object} opts
 * @param {string} opts.projectDir
 * @param {object} opts.api a ParticleApi (or ApiCache) with `getLibraryClient()`
 * @param {UI} [opts.ui]
 * @param {string} [opts.accessToken] defaults to the saved token
 * @returns {Promise<Array<{ name: string, version: string }>>} what was vendored
 */
async function vendorProjectLibraries({ projectDir, api, ui = new UI(), accessToken = settings.access_token }) {
	const missing = await missingDependencies(projectDir);
	if (missing.length === 0) {
		return missing;
	}
	if (!accessToken) {
		const names = missing.map(d => `${d.name}@${d.version}`).join(', ');
		throw new Error(`The project depends on libraries that are not in lib/ yet (${names}). Log in with 'particle login' or run 'particle library install --vendored' once, then retry`);
	}
	const apiClient = api.getLibraryClient();
	for (const dependency of missing) {
		const site = new VendorSite({ dependency, projectDir, apiClient, ui });
		await site.run(new LibraryInstallCommand());
	}
	return missing;
}

module.exports = {
	readDependencies,
	missingDependencies,
	vendorProjectLibraries
};
