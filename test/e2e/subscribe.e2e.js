const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME
} = require('../lib/env');


describe('Subscribe Commands [@device]', () => {
	const help = [
		'Listen to device event stream',
		'Usage: particle subscribe [options] [event...]',
		'',
		'Global Options:',
		'  -v, --verbose  Increases how much logging to display  [count]',
		'  -q, --quiet    Decreases how much logging to display  [count]',
		'',
		'Options:',
		'  --all     Listen to all events instead of just those from my devices  [boolean]',
		'  --device  Listen to events from this device only  [string]',
		'',
		'Examples:',
		'  particle subscribe             Subscribe to all event published by my devices',
		'  particle subscribe update      Subscribe to events starting with update from my devices',
		'  particle subscribe --device x  Subscribe to all events published by device x',
		'  particle subscribe --all       Subscribe to public events and all events published by my devices'
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
		await cli.flashStrobyFirmwareOTAForTest();
	});

	after(async () => {
		await cli.run(['call', DEVICE_NAME, 'stop'], { reject: true });
		await cli.logout();
		await cli.setDefaultProfile();
	});

	it('Shows `help` content', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['help', 'subscribe']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Shows `help` content when run with `--help` flag', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['subscribe', '--help']);

		expect(stdout).to.equal('');
		expect(stderr.split('\n')).to.include.members(help);
		expect(exitCode).to.equal(0);
	});

	it('Subscribes to a device\'s events', async () => {
		await cli.run(['call', DEVICE_NAME, 'start'], { reject: true });

		const args = ['subscribe', '--device', DEVICE_ID];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe, listen, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to all events from ${DEVICE_ID}'s stream`);
		expect(listen).to.equal(`Listening to: /v1/devices/${DEVICE_ID}/events`);
		expect(events).to.have.lengthOf.above(2);
		expect(isCanceled).to.equal(true);

		const event1 = JSON.parse(events[0]);
		const event2 = JSON.parse(events[1]);

		expect(event1).to.have.property('name', 'led');
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', DEVICE_ID);
		expect(event2).to.have.property('name', 'led');
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', DEVICE_ID);
	});
});

