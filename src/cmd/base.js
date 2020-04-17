const { errors: { usageError } } = require('../app/command-processor');
const spinnerMixin = require('../lib/spinner-mixin');
const UI = require('../lib/ui');

const DEVICE_ID_PTN = /^[0-9a-f]{24}$/i;


module.exports = class CLICommandBase {
	constructor({
		stdin = process.stdin,
		stdout = process.stdout,
		stderr = process.stderr
	} = {}) {
		this.stdin = stdin;
		this.stdout = stdout;
		this.stderr = stderr;
		this.ui = new UI({ stdin, stdout, stderr });
		spinnerMixin(this);
	}

	isDeviceId(x){
		return DEVICE_ID_PTN.test(x);
	}

	showUsageError(msg){
		return Promise.reject(usageError(msg));
	}

	showProductDeviceNameUsageError(device){
		return this.showUsageError(
			`\`device\` must be an id when \`--product\` flag is set - received: ${device}`
		);
	}
};

