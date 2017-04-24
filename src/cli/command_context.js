const pipeline = require('when/pipeline');

class CommandContext {

	identifyUser(ApiClient = new require('../../oldlib/ApiClient'), api = new ApiClient()) {
		if (api.ready()) {
			return api.identifyUser();
		} else {
			return Promise.reject();
		}
	}

	isIdentity(user) {
		return Boolean(user && user.id && user.email);
	}

	/**
	 * Retrieves the tracking details for the current logged in user.
	 */
	trackingUser(settings = require('../../settings')) {
		if (this.isIdentity(settings.identity)) {
			return Promise.resolve(settings.identity);
		} else {
			return this.identifyUser()
				.then(user => {
					if (this.isIdentity(user)) {
						settings.override(null, 'identity', user);
						return user;
					} else {
						return null;
					}
				});
		}
	}

	/**
	 * Creates the context object for command execution.
	 */

	context(pkg = require('../../package.json'), settings=require('../../settings')) {
		// todo - allow the API key to be overridden in the environment so that CLI use during development/testing
		// is tracked against a distinct source
		return pipeline([
			() => this.trackingUser(settings),
			(user) => {
				return {
					user,
					tool: {name: 'cli', version: pkg.version},
					api: {key: 'p8DuwER9oRds1CTfL6FJrbYETYA1grCw'}
				}
			}
		]);
	}
}

const test = {
	CommandContext
};

function commandContext() {
	return new CommandContext().context()
}

export {
	commandContext,
	test
};
