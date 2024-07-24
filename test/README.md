# Particle CLI - End-to-End Tests

This directory contains mocha-driven end-to-end (e2e) tests as well as various fixtures and supporting libraries.


## Setup

The e2e tests run commands against the CLI as a user would. As such, you'll need to provide basic user and device info to facilitate operations like `login`, etc.

Create an `.env` file at the root of this directory (e.g. `./test/.env`).

```
E2E_USERNAME=<test user's username>
E2E_PASSWORD=<your test user's password>
E2E_DEVICE_ID=<your test device's id>
E2E_DEVICE_NAME=<your test device's name>
E2E_DEVICE_PLATFORM_ID=<the platform id of your test device>
E2E_DEVICE_PLATFORM_NAME=<the platform name of your test device>
E2E_DEVICE_DEVICE_CELLULAR_IMEI=<IMEI of your test device if cellular>
E2E_DEVICE_DEVICE_CELLULAR_ICCID=<ICCID of your test device if cellular>	
E2E_FOREIGN_USERNAME=<username for 3rd-party account>
E2E_FOREIGN_PASSWORD=<password for 3rd-party account>
E2E_FOREIGN_DEVICE_ID=<id for 3rd-party device the test user DOES NOT own>
E2E_FOREIGN_DEVICE_NAME=<name for 3rd-party device>
E2E_FOREIGN_DEVICE_PLATFORM_ID=<platform id for 3rd-party device>
E2E_FOREIGN_DEVICE_PLATFORM_NAME=<platform name for 3rd-party device>
E2E_PRODUCT_01_ID=<id for product owned by test user>
E2E_PRODUCT_01_NAME=<product name>
E2E_PRODUCT_01_DEVICE_01_ID=<id for 1st device in product>
E2E_PRODUCT_01_DEVICE_01_NAME=<name for 1st device in product>
E2E_PRODUCT_01_DEVICE_01_GROUP=<1st device's group - should be unique>
E2E_PRODUCT_01_DEVICE_01_PLATFORM_ID=<platform id of your 1st product device>
E2E_PRODUCT_01_DEVICE_01_PLATFORM_NAME=<platform name of your 1st product device>
E2E_PRODUCT_01_DEVICE_02_ID=<id for 2nd device in product>
E2E_PRODUCT_01_DEVICE_02_NAME=<name for 2nd device in product>
E2E_PRODUCT_01_DEVICE_02_GROUP=<2nd device's group - should be unique>
E2E_PRODUCT_01_DEVICE_02_PLATFORM_ID=<platform id of your 1st product device>
E2E_PRODUCT_01_DEVICE_02_PLATFORM_NAME=<platform name of your 1st product device>
```

_NOTE: Your device will be flashed, etc. Test failures may leave it in a bad state. **Please DO NOT use a mission-critical device!**_

Additional details:
* `E2E_USERNAME` must not have 2FA enabled
* `E2E_DEVICE_NAME` should be claimed to your user and connected to your computer over USB
  * It should be running firmware with a `check` function

#### Requisites:
* You should have 3 devices connected to the cloud.
* two of them should belong to the same product and claimed by the user
* one should be outside from any product and claimed by the user

###### Configuring `E2E_DEVICE_*`:
* Pick a device that will be connected to your computer over USB
* This device should:
  * be connected to the cloud
  * be claimed to your `E2E_USERNAME`
  * be running firmware `stroby` compile and flash `test/__fixtures__/projects/stroby`
  * be outside from any product
  * be named with `E2E_DEVICE_NAME`
* Works better if the device is Gen3

###### Configuring `E2E_FOREIGN_DEVICE_*`:
* Pick a device that your `E2E_USERNAME` does not own and can't claim or have access (pick one from `connectivity-test-fleet@particle.io` sandbox)
* This device should:
  * Not required to be connected to the cloud (can be offline)
  * be claimed to another user

###### Configuring `E2E_PRODUCT_01_*`:
* Create a product into your sandbox account (`E2E_USERNAME` sandbox account)
* Add two devices to the product
* Those devices must be sorted by name.
* Add a different group name to each device (unique ones)
* This devices should:
  * be connected to the cloud
  * be claimed to your `E2E_USERNAME`
  * be running firmware `stroby` compile and flash `test/__fixtures__/projects/stroby`
  * be named with `E2E_PRODUCT_01_DEVICE_01_NAME` and `E2E_PRODUCT_01_DEVICE_02_NAME`
  * not be connected to your computer over USB

***IMPORTANT***

  Every time you run the tests, the devices must be connected to the cloud.
  If you have a device that is not connected to the cloud, some tests will fail.
  
  If for some reason a test fails try to run it using `it.only` expression,
  this will run only the test and should pass (in case there is no real issue or regression).

## How to Run

The e2e tests run in two modes: with a device connected, and without. Since the current CI system does not have access to Particle hardware, tests that depend on accessing a device are disabled.


### Running _with_ a device

1. Disconnect all Particle devices from your computer's USB
2. Connect your test device via USB and wait for it to connect to the cloud (breathe cyan)
3. run `npm run test:e2e`


### Running _without_ a device

1. run `npm run test:e2e:no-device`

### Running device protection tests

1. Ensure the device `E2E_PRODUCT_01_DEVICE_01_ID` in product `E2E_PRODUCT_01_ID` is an Open Device in a product with device protection active at the start of the tests.
2. Ensure the device is not in DFU mode.
3. run `npm run test:e2e:device-protection`

## Adding Tests

Test filenames are formatted like: `<command>.e2e.js` and located within the `./test/e2e` directory. The `./test` directory is organized as follows:


```
test
├── __fixtures__  <-- test fixtures (projects, data, etc)
│   ├── binaries
│   │   └── ...
│   ├── libraries
│   │   └── ...
│   ├── projects
│   │   └── ...
│   └── ...
│
├── __mocks__  <-- mocks for tests (unit, integration, etc)
│   ├── serial.mock.js
│   └── ...
│
├── e2e  <-- end-to-end tests
│   ├── binary.e2e.js
│   ├── call.e2e.js
│   ├── cloud.e2e.js
│   ├── compile.e2e.js
│   ├── config.e2e.js
│   └── ...
│
├── integration  <-- legacy integration tests
│   ├── command-processor.integration.js
│   └── ...
│
├── lib  <-- supporting libraries
│   ├── cli.js
│   ├── env.js
│   ├── fs.js
│   └── ...
│
├── .env <-- e2e test environment variables
├── README.md
└── ...
```


### Naming

Tests should be grouped by command. Your top-level `describe()` title should be formatted like `<cmd> Commands [<tags>]` where `cmd` is the 1st level command you are testing (e.g. "Cloud", "Call", etc) and `tags` are a comma-delimited set of tokens prefixed with `@` (e.g. `@device`). Nested `describe()` titles should be formatted like `<subcmd> Subcommand`. Avoid deeply nesting `describe()` calls (2 levels is ideal).

`describe()` titles should be title-case, `it()` names should be sentence-case.


For example:

```js
describe('USB Commands [@device]', () => {
	describe('USB DFU Subcommand', () => {
		it('Enters DFU mode with confirmation', async () => {
			//...
		});
	});
});

```


### Tags

Tags provide an easy way to filter tests using use mocha's `--grep` feature ([docs](https://github.com/mochajs/mocha/wiki/Tagging)). We use the `@device` tag to identify test suites which _require_ a physical Particle hardware device in order to run.


## Known Issues

* tests run somewhat slowly (~30m) and are generally less stable than unitish tests
* currently known to work under macOS _only_ when running with a device
* tests should run in docker to achieve proper isolation
* some tests require two devices to be connected via USB or they will fail
* when a test fails, make sure to let the "afterAll" hook still runs to return your account back to normal, or you might end up with devices in an invalid state or modified products in console

