import {analytics} from 'particle-commands'
import {buildAPIClient} from './apiclient';

/**
 * Creates the context object for command execution.
 */

function commandContext(pkg = require('../../package.json'), settings=require('../../settings')) {
	const tool = { name: 'cli', version: pkg.version };
	const api = { key: settings.get('trackingApiKey') };
	const trackingIdentity = settings.fetchUpdate('trackingIdentity');
	const auth = settings.access_token;
	const apiClient = buildAPIClient();
	return analytics.buildContext({ tool, api, trackingIdentity, apiClient });
}


export {
	commandContext
};
