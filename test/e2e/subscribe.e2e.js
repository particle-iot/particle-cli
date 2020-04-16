const { expect } = require('../setup');
const { delay } = require('../lib/mocha-utils');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	PRODUCT_01_ID,
	PRODUCT_01_DEVICE_01_ID
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
		'  --all      Listen to all events instead of just those from my devices  [boolean]',
		'  --device   Listen to events from this device only  [string]',
		'  --product  Target a device within the given Product ID or Slug  [string]',
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
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to all events from ${DEVICE_ID}'s stream`);
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

	it('Subscribes to a device\'s events using `--max` flag', async () => {
		const count = 5;
		await cli.run(['call', DEVICE_NAME, 'start'], { reject: true });
		const args = ['subscribe', '--device', DEVICE_ID, '--max', count];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const events = stdout.split('\n').slice(3, 8);

		expect(events).to.have.lengthOf(count);
		events.forEach(e => {
			const data = JSON.parse(e);
			expect(data).to.have.property('name', 'led');
			expect(data).to.have.property('data').match(/ON|OFF/);
			expect(data).to.have.property('coreid', DEVICE_ID);
		});
		expect(stdout).to.include(`Subscribing to all events from ${DEVICE_ID}'s stream`);
		expect(stdout).to.include(`This command will exit after receiving ${count} event(s)...`);
		expect(stdout).to.include(`${count} event(s) received. Exiting...`);
		expect(stderr).to.include('');
		expect(exitCode).to.equal(0);
	});

	it('Subscribes to a device\'s events using `--until` flag', async () => {
		const data = 'ON';
		await cli.run(['call', DEVICE_NAME, 'start'], { reject: true });
		const args = ['subscribe', '--device', DEVICE_ID, '--until', data];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const events = stdout.split('\n').slice(3).filter(e => e.startsWith('{'));

		events.forEach(e => {
			const data = JSON.parse(e);
			expect(data).to.have.property('name', 'led');
			expect(data).to.have.property('data').match(/ON|OFF/);
			expect(data).to.have.property('coreid', DEVICE_ID);
		});
		expect(stdout).to.include(`Subscribing to all events from ${DEVICE_ID}'s stream`);
		expect(stdout).to.include(`This command will exit after receiving event data matching: '${data}'`);
		expect(stdout).to.include('Matching event received. Exiting...');
		expect(stderr).to.include('');
		expect(exitCode).to.equal(0);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product device\'s events', async () => {
		await cli.run(['call', PRODUCT_01_DEVICE_01_ID, 'start', '--product', PRODUCT_01_ID], { reject: true });

		const args = ['subscribe', '--device', PRODUCT_01_DEVICE_01_ID, '--product', PRODUCT_01_ID];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to all events from ${PRODUCT_01_DEVICE_01_ID}'s stream`);
		expect(events).to.have.lengthOf.above(2);
		expect(isCanceled).to.equal(true);

		const event1 = JSON.parse(events[0]);
		const event2 = JSON.parse(events[1]);

		expect(event1).to.have.property('name', 'led');
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
		expect(event2).to.have.property('name', 'led');
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
	});
});

