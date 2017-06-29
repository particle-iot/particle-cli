
var commandContext = require('../dist/cli/command_context').commandContext;
var analytics = require('particle-commands/dist/lib/analytics');

function track(command, event, properties) {
	return commandContext().
	then(function(context) {
		return analytics.track({ command:command, context:context, site:{}, event: event, properties: properties});
	});
}

module.exports = {
	track
};