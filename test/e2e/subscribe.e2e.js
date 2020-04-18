const os = require('os');
const { expect } = require('../setup');
const cli = require('../lib/cli');
const {
	DEVICE_ID,
	DEVICE_NAME,
	PRODUCT_01_ID,
	PRODUCT_01_DEVICE_02_ID,
	PRODUCT_01_DEVICE_02_NAME
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
		'  particle subscribe                  Subscribe to all event published by my devices',
		'  particle subscribe update           Subscribe to events starting with `update` from my devices',
		'  particle subscribe --product 12345  Subscribe to all events published by devices within product `12345`',
		'  particle subscribe --device blue    Subscribe to all events published by device `blue`',
		'  particle subscribe --all            Subscribe to public events and all events published by my devices',
		'  particle subscribe --until data     Subscribe to all events and exit when an event has data matching `data`',
		'  particle subscribe --max 4          Subscribe to all events and exit after seeing `4` events',
		''
	];

	before(async () => {
		await cli.setTestProfileAndLogin();
		await cli.flashStrobyFirmwareOTAForTest();
	});

	after(async () => {
		await cli.setTestProfileAndLogin();
		await cli.callStrobyStop(DEVICE_NAME);
		await cli.callStrobyStop(PRODUCT_01_DEVICE_02_ID, PRODUCT_01_ID);
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

		const args = ['subscribe'];
		const { events, received: [msg], isCanceled } = await runAndCollectEventOutput(args);

		expect(msg).to.equal('Subscribing to all events from my devices');
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			const namePtn = new RegExp(`led|${DEVICE_ID.substring(0, 6)}`);
			expect(event).to.have.property('name').match(namePtn);
			expect(event).to.have.property('data').match(/ON|OFF|active/);
			expect(event).to.have.property('coreid', DEVICE_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	it('Subscribes to user events by name', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const eventName = 'led';
		const args = ['subscribe', eventName];
		const { events, received: [msg], isCanceled } = await runAndCollectEventOutput(args);

		expect(msg).to.equal(`Subscribing to "${eventName}" from my devices`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			expect(event).to.have.property('name', eventName);
			expect(event).to.have.property('data').match(/ON|OFF/);
			expect(event).to.have.property('coreid', DEVICE_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	it('Subscribes to `--all` events', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const eventName = DEVICE_ID.substring(0, 6);
		const eventData = 'active';
		const args = ['subscribe', '--all', eventName];
		const { received: [msg, ...data], isCanceled } = await runAndCollectEventOutput(args);
		const events = getPublishedEventsByName(data, eventName);

		expect(msg).to.equal(`Subscribing to "${eventName}" from the firehose (all devices) and my personal stream (my devices)`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			expect(event).to.have.property('name', eventName);
			expect(event).to.have.property('data').to.equal(eventData);
			expect(event).to.have.property('coreid', DEVICE_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	it('Subscribes to `--all` events with partial matching', async () => {
		await cli.callStrobyStart(DEVICE_NAME);
		const eventName = 't';
		const args = ['subscribe', '--all', eventName];
		const { events, received: [msg], isCanceled } = await runAndCollectEventOutput(args);

		expect(msg).to.equal(`Subscribing to "${eventName}" from the firehose (all devices) and my personal stream (my devices)`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			expect(event).to.have.property('name');
			expect(event.name.startsWith(eventName)).to.equal(true);
			expect(event).to.have.property('data');
			expect(event).to.have.property('coreid');
		});
		expect(isCanceled).to.equal(true);
	});

	it('Fails when `--all` flag is set but event name is not provided', async () => {
		const { stdout, stderr, exitCode } = await cli.run(['subscribe', '--all']);
		expect(stdout).to.include('`event` parameter is required when `--all` flag is set');
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(1);
	});

	it('Subscribes to device\'s events', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const args = ['subscribe', '--device', DEVICE_ID];
		const { events, received: [msg], isCanceled } = await runAndCollectEventOutput(args);

		expect(msg).to.equal(`Subscribing to all events from device ${DEVICE_ID}'s stream`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			const namePtn = new RegExp(`led|${DEVICE_ID.substring(0, 6)}`, 'i');
			expect(event).to.have.property('name').match(namePtn);
			expect(event).to.have.property('data').match(/ON|OFF|active/);
			expect(event).to.have.property('coreid', DEVICE_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	it('Subscribes to a device\'s event by name', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const eventName = 'led';
		const args = ['subscribe', '--device', DEVICE_ID, eventName];
		const { events, received: [msg], isCanceled } = await runAndCollectEventOutput(args);

		expect(msg).to.equal(`Subscribing to "${eventName}" from device ${DEVICE_ID}'s stream`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			expect(event).to.have.property('name', 'led');
			expect(event).to.have.property('data').match(/ON|OFF/);
			expect(event).to.have.property('coreid', DEVICE_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	it('Subscribes to a device\'s events using `--max` flag', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const count = 5;
		const eventName = 'led';
		const args = ['subscribe', eventName, '--device', DEVICE_ID, '--max', count];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const events = getPublishedEventsByName(stdout.split('\n'), eventName);

		expect(events).to.have.lengthOf(count);
		events.forEach(event => {
			expect(event).to.have.property('name', 'led');
			expect(event).to.have.property('data').match(/ON|OFF/);
			expect(event).to.have.property('coreid', DEVICE_ID);
		});
		expect(stdout).to.include(`Subscribing to "${eventName}" from device ${DEVICE_ID}'s stream`);
		expect(stdout).to.include(`This command will exit after receiving ${count} event(s)...`);
		expect(stdout).to.include(`${count} event(s) received. Exiting...`);
		expect(stderr).to.include('');
		expect(exitCode).to.equal(0);
	});

	it('Subscribes to a device\'s events using `--until` flag', async () => {
		await cli.callStrobyStart(DEVICE_NAME);

		const data = 'ON';
		const eventName = 'led';
		const args = ['subscribe', eventName, '--device', DEVICE_ID, '--until', data];
		const { stdout, stderr, exitCode } = await cli.run(args);
		const events = getPublishedEventsByName(stdout.split('\n'), eventName);

		events.forEach(event => {
			expect(event).to.have.property('name', 'led');
			expect(event).to.have.property('data').match(/ON|OFF/);
			expect(event).to.have.property('coreid', DEVICE_ID);
		});
		expect(stdout).to.include(`Subscribing to "${eventName}" from device ${DEVICE_ID}'s stream`);
		expect(stdout).to.include(`This command will exit after receiving event data matching: '${data}'`);
		expect(stdout).to.include('Matching event received. Exiting...');
		expect(stderr).to.include('');
		expect(exitCode).to.equal(0);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product\'s events', async () => {
		await cli.callStrobyStart(PRODUCT_01_DEVICE_02_ID, PRODUCT_01_ID);

		const eventName = 'led';
		const args = ['subscribe', '--product', PRODUCT_01_ID];
		const { received: [msg, ...data], isCanceled } = await runAndCollectEventOutput(args);
		const events = getPublishedEventsByName(data, eventName);

		expect(msg).to.equal(`Subscribing to all events from product ${PRODUCT_01_ID}'s stream`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			expect(event).to.have.property('name', 'led');
			expect(event).to.have.property('data').match(/ON|OFF/);
			expect(event).to.have.property('coreid', PRODUCT_01_DEVICE_02_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product\'s events by name', async () => {
		await cli.callStrobyStart(PRODUCT_01_DEVICE_02_ID, PRODUCT_01_ID);

		const eventName = 'led';
		const args = ['subscribe', '--product', PRODUCT_01_ID, eventName];
		const { events, received: [msg], isCanceled } = await runAndCollectEventOutput(args);

		expect(msg).to.equal(`Subscribing to "${eventName}" from product ${PRODUCT_01_ID}'s stream`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			expect(event).to.have.property('name', 'led');
			expect(event).to.have.property('data').match(/ON|OFF/);
			expect(event).to.have.property('coreid', PRODUCT_01_DEVICE_02_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product device\'s events', async () => {
		await cli.callStrobyStart(PRODUCT_01_DEVICE_02_ID, PRODUCT_01_ID);

		const eventName = 'led';
		const args = ['subscribe', '--product', PRODUCT_01_ID, '--device', PRODUCT_01_DEVICE_02_ID];
		const { received: [msg, ...data], isCanceled } = await runAndCollectEventOutput(args);
		const events = getPublishedEventsByName(data, eventName);

		expect(msg).to.equal(`Subscribing to all events from product ${PRODUCT_01_ID} device ${PRODUCT_01_DEVICE_02_ID}'s stream`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			expect(event).to.have.property('name', 'led');
			expect(event).to.have.property('data').match(/ON|OFF/);
			expect(event).to.have.property('coreid', PRODUCT_01_DEVICE_02_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	// TODO (mirande): need to ensure device is running expected firmware and online
	// once flashing product devices is implemented - as it is, the expectation
	// is that your product device is running the `stroby` firmware found in:
	// test/__fixtures__/projects/stroby - see: cli.flashStrobyFirmwareOTAForTest()
	it('Subscribes to a product device\'s event by name', async () => {
		await cli.callStrobyStart(PRODUCT_01_DEVICE_02_ID, PRODUCT_01_ID);

		const eventName = 'led';
		const args = ['subscribe', '--product', PRODUCT_01_ID, '--device', PRODUCT_01_DEVICE_02_ID, eventName];
		const { events, received: [msg], isCanceled } = await runAndCollectEventOutput(args);

		expect(msg).to.equal(`Subscribing to "${eventName}" from product ${PRODUCT_01_ID} device ${PRODUCT_01_DEVICE_02_ID}'s stream`);
		expect(events).to.have.lengthOf.above(2);
		events.forEach(event => {
			expect(event).to.have.property('name', 'led');
			expect(event).to.have.property('data').match(/ON|OFF/);
			expect(event).to.have.property('coreid', PRODUCT_01_DEVICE_02_ID);
		});
		expect(isCanceled).to.equal(true);
	});

	it('Fails to subscribe to a product device\'s events when `device` param is not an id', async () => {
		const args = ['subscribe', '--product', PRODUCT_01_ID, '--device', PRODUCT_01_DEVICE_02_NAME];
		const { stdout, stderr, exitCode } = await cli.run(args);

		expect(stdout).to.include(`\`device\` must be an id when \`--product\` flag is set - received: ${PRODUCT_01_DEVICE_02_NAME}`);
		expect(stderr.split(os.EOL)).to.include.members(help);
		expect(exitCode).to.equal(1);
	});

	it('Fails when user is signed-out', async () => {
		await cli.logout();
		const { stdout, stderr, exitCode } = await cli.run(['subscribe']);

		expect(stdout).to.include('Error fetching event stream: Invalid access token');
		expect(stderr).to.equal('');
		expect(exitCode).to.equal(1);
	});

	function getPublishedEventsByName(events, name){
		return parseEvents(events).filter(e => e.name === name);
	}

	function parseEvents(results){
		if (!Array.isArray(results) || !results.length){
			return;
		}
		return results
			.filter(str => str.trim().startsWith('{'))
			.map(data => JSON.parse(data));
	}

	// TODO (mirande): capture stdout and stderr independently
	async function runAndCollectEventOutput(...args){
		const subprocess = cli.run(...args);
		const received = [];

		await waitForResult(subprocess, (data) => {
			const log = data.toString('utf8').trim();

			received.push(log);

			if (received.length > 10){
				return true;
			}
			return false;
		});

		const { isCanceled } = await subprocess;
		const events = parseEvents(received);
		return { events, received, isCanceled };
	}

	function waitForResult(subprocess, isFinished){
		return new Promise((resolve, reject) => {
			subprocess.all.on('data', (data) => {
				if (isFinished(data)){
					subprocess.cancel();
					resolve();
				}
			});
			subprocess.all.on('error', (error) => {
				subprocess.cancel();
				reject(error);
			});
			subprocess.all.on('close', () => {
				subprocess.cancel();
				resolve();
			});
		});
	}
});

