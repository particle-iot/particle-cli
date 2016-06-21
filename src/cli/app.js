import Interpreter from '../../lib/interpreter';

export default {
	run() {
		const cli = new Interpreter();
		cli.supressWarmupMessages = true;
		cli.startup();
		cli.handle(process.argv, true);
	}
};
