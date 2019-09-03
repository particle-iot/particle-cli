const { expect, sinon } = require('../setup');
const stripANSI = require('../lib/ansi-strip');
const matches = require('../lib/capture-matches');
const cli = require('../lib/cli');


describe('Help & Unknown Command / Argument Handling', () => {
	const sandbox = sinon.createSandbox();
	const commandList = [
		'Commands:',
		'  binary      Inspect binaries',
		'  call        Call a particular function on a device',
		'  cloud       Access Particle cloud functionality',
		'  compile     Compile a source file, or directory using the cloud compiler',
		'  config      Configure and switch between multiple accounts',
		'  device      Manipulate a device',
		'  doctor      Put your device back into a healthy state',
		'  flash       Send firmware to your device',
		'  function    Call functions on your device',
		'  get         Retrieve a value from your device',
		'  identify    Ask for and display device ID via serial',
		'  keys        Manage your device\'s key pair and server public key',
		'  library     Manage firmware libraries',
		'  list        Display a list of your devices, as well as their variables and functions',
		'  login       Login to the cloud and store an access token locally',
		'  logout      Log out of your session and clear your saved access token',
		'  mesh        Manage mesh networks',
		'  monitor     Connect and display messages from a device',
		'  nyan        Make your device shout rainbows',
		'  preprocess  Preprocess a Wiring file (ino) into a C++ file (cpp)',
		'  project     Manage application projects',
		'  publish     Publish an event to the cloud',
		'  serial      Simple serial interface to your devices',
		'  setup       Do the initial setup & claiming of your device',
		'  subscribe   Listen to device event stream',
		'  token       Manage access tokens (require username/password)',
		'  udp         Talk UDP to repair devices, run patches, check Wi-Fi, and more!',
		'  update      Update the system firmware of a device via USB',
		'  update-cli  Update the Particle CLI to the latest version',
		'  usb         Control USB devices',
		'  variable    Retrieve and monitor variables on your device',
		'  webhook     Manage webhooks that react to device event streams',
		'  whoami      prints signed-in username'
	];

	const allCmds = ['binary inspect', 'binary', 'call', 'cloud claim',
		'cloud list', 'cloud remove', 'cloud name', 'cloud flash',
		'cloud compile', 'cloud nyan', 'cloud login', 'cloud logout',
		'cloud', 'compile', 'config', 'device add', 'device remove',
		'device rename', 'device doctor', 'device', 'doctor', 'flash',
		'function list', 'function call', 'function', 'get', 'identify',
		'keys new', 'keys load', 'keys save', 'keys send', 'keys doctor',
		'keys server', 'keys address', 'keys protocol', 'keys', 'library add',
		'library create', 'library copy', 'library list', 'library migrate',
		'library search', 'library upload', 'library publish', 'library view',
		'library', 'list', 'login', 'logout', 'mesh create', 'mesh add',
		'mesh remove', 'mesh list', 'mesh info', 'mesh scan', 'mesh', 'monitor',
		'nyan', 'preprocess', 'project create', 'project', 'publish',
		'serial list', 'serial monitor', 'serial identify', 'serial wifi',
		'serial mac', 'serial inspect', 'serial flash', 'serial claim',
		'serial', 'setup', 'subscribe', 'token list', 'token revoke',
		'token create', 'token', 'udp send', 'udp listen', 'udp', 'update',
		'update-cli', 'usb list', 'usb start-listening', 'usb stop-listening',
		'usb safe-mode', 'usb dfu', 'usb reset', 'usb configure', 'usb',
		'variable list', 'variable get', 'variable monitor', 'variable',
		'webhook create', 'webhook list', 'webhook delete', 'webhook POST',
		'webhook GET', 'webhook', 'whoami'];

	const mainCmds = dedupe(allCmds.map(c => c.split(' ')[0]));

	afterEach(() => {
		sandbox.restore();
	});

	it('Shows `help` content when run without arguments', async () => {
		const { stdout, stderr, exitCode } = await cli.run();

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(commandList);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run('--help');

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(commandList);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with unknown command', async () => {
		const { stdout, stderr, exitCode } = await cli.run('WATNOPE');

		expect(stdout).to.equal('No such command \'WATNOPE\'');
		expect(stderr.split('\n')).to.include.members(commandList);
		expect(exitCode).to.equal(1);
	});

	it('Shows `help` content when run with unknown flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run('--WATNOPE');

		expect(stdout).to.equal('Unknown argument \'WATNOPE\'');
		expect(stderr.split('\n')).to.include.members(commandList);
		expect(exitCode).to.equal(1);
	});

	it('Shows `help` content for all commands', async () => {
		const { stderr } = await cli.run();
		const cmds = findHelpCommands(stderr);
		sandbox.spy(cli, 'run');

		expect(cmds).to.eql(mainCmds);

		await expectForEachCommand(cmds, (cmd, help) => {
			expect(help).to.include(`Usage: particle ${cmd}`);
			expect(help).to.include('Global Options:');
		});

		const called = cli.run.args.map(a => a[0].join(' '));

		expect(called).to.eql(allCmds.reverse().map(c => `${c} --help`));
	}).timeout(5 * 1000 * 60);

	function dedupe(arr){
		return [...new Set(arr)];
	}

	function findHelpCommands(str){
		const help = stripANSI(str);
		const cmdListPtn = /Commands:(.*?)(?:[\r?\n]{2}|$)/sg;
		const cmdList = matches(help, cmdListPtn)[0] || '';
		const cmdsPtn = /^.+?([A-Za-z0-9-]+).*$/mg;
		return matches(cmdList, cmdsPtn);
	}

	async function expectForEachCommand(cmds, assert){
		let cmd;

		while ((cmd = cmds.pop())){
			const args = cmd.split(' ');
			const { stderr: help } = await cli.run([...args, '--help']);

			try {
				assert(cmd, help);
			} catch (error){
				error.message = `FOR CMD: ${cmd} - ${error.message}`;
				throw error;
			}

			const subCmds = findHelpCommands(help);

			if (subCmds.length){
				await expectForEachCommand(subCmds.map(scmd => `${cmd} ${scmd}`), assert);
			}
		}
	}
});

