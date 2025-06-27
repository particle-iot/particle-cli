const CLICommandBase = require('./base');
const path = require('path');
const os = require('os');

const {
	getEDLDevice,
	getTachyonInfo
} = require('../lib/tachyon-utils');


module.exports = class IdentifyTachyonCommand extends CLICommandBase {
	constructor({ ui } = {}) {
		super();
		this.ui = ui || this.ui;
	}

	async identify() {
		const device = await getEDLDevice({ ui: this.ui });
		const outputLog = path.join(os.tmpdir(), `tachyon_${device.id}_identify_${Date.now()}.log`);

		try {
			const tachyonInfo = await getTachyonInfo({ outputLog, ui: this.ui, device });
			this.printIdentification(tachyonInfo);
		} catch (error) {
			this.ui.stdout.write(`An error ocurred while trying to identify your tachyon ${os.EOL}`);
			this.ui.stdout.write(`Error: ${error.message} ${os.EOL}`);
			this.ui.stdout.write(`Verify your logs ${outputLog} for more information ${os.EOL}`);
		}
	}

	printIdentification({ deviceId, region, manufacturingData, osVersion }) {
		this.ui.stdout.write(`Device ID: ${deviceId}${os.EOL}`);
		this.ui.stdout.write(`Region: ${region}${os.EOL}`);
		this.ui.stdout.write(`Manufacturing data: ${manufacturingData}${os.EOL}`);
		this.ui.stdout.write(`OS Version: ${osVersion}${os.EOL}`);
	}
};
