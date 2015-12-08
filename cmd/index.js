'use strict';

module.exports = function registerCommands(app, cli) {
	// help must come first
	require('./help')(app, cli);

	require('./cloud')(app, cli);
	require('./keys')(app, cli);

	require('./alias')(app, cli);
};
