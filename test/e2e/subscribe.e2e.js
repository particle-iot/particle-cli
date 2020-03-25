const os = require('os');
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
		'Usage: particle subscribe [options] [event]',
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
		await cli.setTestProfileAndLogin();
		await cli.callStrobyStop(DEVICE_NAME);
		await cli.callStrobyStop(PRODUCT_01_DEVICE_01_ID, PRODUCT_01_ID);
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

	it('Subscribes to user events', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const eventName = 'led';
		const args = ['subscribe'];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal('Subscribing to all events from my devices');
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', eventName);
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', DEVICE_ID);
		expect(event2).to.have.property('name', eventName);
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', DEVICE_ID);
	});

	it('Subscribes to user events by name', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const eventName = 'led';
		const args = ['subscribe', eventName];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to "${eventName}" from my devices`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', eventName);
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', DEVICE_ID);
		expect(event2).to.have.property('name', eventName);
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', DEVICE_ID);
	});

	it('Subscribes to `--all` events', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const eventName = DEVICE_ID.substring(0, 6);
		const eventData = 'active';
		const args = ['subscribe', '--all', eventName];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to "${eventName}" from the firehose (all devices) and my personal stream (my devices)`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', eventName);
		expect(event1).to.have.property('data').to.equal(eventData);
		expect(event1).to.have.property('coreid', DEVICE_ID);
		expect(event2).to.have.property('name', eventName);
		expect(event2).to.have.property('data').to.equal(eventData);
		expect(event2).to.have.property('coreid', DEVICE_ID);
	});

	it('Subscribes to `--all` events with partial matching', async () => {
		const eventName = 't';
		const args = ['subscribe', '--all', eventName];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to "${eventName}" from the firehose (all devices) and my personal stream (my devices)`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		events.forEach(e => {
			const event = JSON.parse(e);
			expect(event).to.have.property('name');
			expect(event.name.startsWith(eventName)).to.equal(true);
			expect(event).to.have.property('data');
			expect(event).to.have.property('coreid');
		});
	});

	it('Fails when `--all` flag is set but event name is not provided', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['subscribe', '--all']);
		expect(stdout).to.include('`event` parameter is required when `--all` flag is set');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(1);
	});

	it('Subscribes to device\'s events', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const eventName = 'led';
		const args = ['subscribe', '--device', DEVICE_ID];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to all events from device ${DEVICE_ID}'s stream`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', 'led');
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', DEVICE_ID);
		expect(event2).to.have.property('name', 'led');
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', DEVICE_ID);
	});

	it('Subscribes to a device\'s event by name', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const eventName = 'led';
		const args = ['subscribe', '--device', DEVICE_ID, eventName];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to "${eventName}" from device ${DEVICE_ID}'s stream`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', 'led');
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', DEVICE_ID);
		expect(event2).to.have.property('name', 'led');
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', DEVICE_ID);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product\'s events', async () => {
		await cli.callStrobyStart(PRODUCT_01_DEVICE_01_ID, PRODUCT_01_ID);

		const eventName = 'led';
		const args = ['subscribe', '--product', PRODUCT_01_ID];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to all events from product ${PRODUCT_01_ID}'s stream`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', 'led');
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
		expect(event2).to.have.property('name', 'led');
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product\'s events by name', async () => {
		await cli.callStrobyStart(PRODUCT_01_DEVICE_01_ID, PRODUCT_01_ID);

		const eventName = 'led';
		const args = ['subscribe', '--product', PRODUCT_01_ID, eventName];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to "${eventName}" from product ${PRODUCT_01_ID}'s stream`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', 'led');
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
		expect(event2).to.have.property('name', 'led');
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product device\'s events', async () => {
		await cli.callStrobyStart(PRODUCT_01_DEVICE_01_ID, PRODUCT_01_ID);

		const eventName = 'led';
		const args = ['subscribe', '--product', PRODUCT_01_ID, '--device', PRODUCT_01_DEVICE_01_ID];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to all events from product ${PRODUCT_01_ID} device ${PRODUCT_01_DEVICE_01_ID}'s stream`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', 'led');
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
		expect(event2).to.have.property('name', 'led');
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product device\'s event by name', async () => {
		await cli.callStrobyStart(PRODUCT_01_DEVICE_01_ID, PRODUCT_01_ID);

		const eventName = 'led';
		const args = ['subscribe', '--product', PRODUCT_01_ID, '--device', PRODUCT_01_DEVICE_01_ID, eventName];
		const subprocess = cli.run(args);

		await delay(5000);
		subprocess.cancel(); // CTRL-C

		const { all, isCanceled } = await subprocess;
		const [subscribe,,, ...events] = all.split('\n');

		expect(subscribe).to.equal(`Subscribing to "${eventName}" from product ${PRODUCT_01_ID} device ${PRODUCT_01_DEVICE_01_ID}'s stream`);
		expect(events).to.have.lengthOf.at.least(2);
		expect(isCanceled).to.equal(true);

		const [event1, event2] = getPublishedEventsByName(events, eventName);

		expect(event1).to.have.property('name', 'led');
		expect(event1).to.have.property('data').match(/ON|OFF/);
		expect(event1).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
		expect(event2).to.have.property('name', 'led');
		expect(event2).to.have.property('data').match(/ON|OFF/);
		expect(event2).to.have.property('coreid', PRODUCT_01_DEVICE_01_ID);
	});

	it('Fails when user is signed-out', async () => {
		await cli.logout();
		const { stdout, stderr, exitCode } = await cli.run(['subscribe']);

		expect(stdout).to.include('Error fetching event stream: Invalid access token');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	function getPublishedEventsByName(events, name){
		return events.map(e => JSON.parse(e)).filter(e => e.name === name);
	}
});

