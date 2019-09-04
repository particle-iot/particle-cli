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
```

_NOTE: Your device will be flashed, etc. Test failures may leave it in a bad state. **Please DO NOT use a mission-critical device!**_


## How to Run

The e2e tests run in two modes: with a device connected, and without. Since the current CI system does not have access to Particle hardware, tests that depend on accessing a device are disabled.


### Running _with_ a device

1. Connect your device via USB and wait for it to connect to the cloud (breathe cyan)
2. run `npm run test:e2e`


### Running _without_ a device

1. run `npm run test:e2e:no-device`


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

Your top-level `describe()` title should be formatted like `<cmd> Commands [<tags>]` where `cmd` is the 1st level command you are testing (e.g. "Cloud", "Call", etc) and `tags` are a comma-delimited set of tokens prefixed with `@` (e.g. `@device`).

`describe()` titles should be title-case, `it()` names should be sentence-case.


For example:

```js
describe('Mesh Commands [@device]', () => {
	it('Removes device from network', async () => {
		//...
	});
});

```


### Tags

Tags provide an easy way to filter tests using use mocha's `--grep` feature ([docs](https://github.com/mochajs/mocha/wiki/Tagging)). We use the `@device` tag to identify test suites which _require_ a physical Particle hardware device in order to run.


## Known Issues

* `node@8` or greater _is required_
* tests run somewhat slowly (~10m) and are generally less stable than unitish tests
* currently known to work under macOS _only_ when running with a device
* tests should run in docker

