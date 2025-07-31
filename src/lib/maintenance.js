const UI = require('./ui');

async function underMaintenance({ ui = new UI() } = {}) {
	ui.write('We\'re performing maintenance on this command. It will be available again shortly.');
}

module.exports = {
	underMaintenance
};
