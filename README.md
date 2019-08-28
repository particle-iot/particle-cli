[![npm](https://img.shields.io/npm/v/particle-cli.svg?style=flat-square)](https://www.npmjs.com/package/particle-cli)[![Build Status](https://travis-ci.org/particle-iot/particle-cli.svg?branch=master)](https://travis-ci.org/particle-iot/particle-cli)[![Coverage Status](https://coveralls.io/repos/github/particle-iot/particle-cli/badge.svg?branch=master)](https://coveralls.io/github/particle-iot/particle-cli?branch=master)[![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg?style=flat-square)](https://github.com/particle-iot/particle-cli/blob/master/LICENSE)

Particle's full-stack Internet of Things (IoT) device platform
gives you everything you need to securely and reliably connect
your IoT devices to the web. For more details please visit [www.particle.io](http:/www.particle.io).


# Particle CLI

The Particle CLI is a powerful tool for interacting with your IoT devices and the Particle Cloud.  The CLI uses [node.js](http://nodejs.org/) and can run on Windows, Mac OS X, and Linux.  It's also [open source](https://github.com/particle-iot/particle-cli) so you can edit and change it, and even send in your changes as [pull requests](https://help.github.com/articles/using-pull-requests) if you want to share!


<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

  - [Installing](#installing)
  - [Getting Started](#getting-started)
    - [particle setup](#particle-setup)
    - [particle help](#particle-help)
  - [Updating Firmware](#updating-firmware)
    - [Photon/P1/Electron](#photonp1electron)
      - [particle update](#particle-update)
  - [Command Reference](#command-reference)
  - [Known Issues](#known-issues)
- [Development](#development)
  - [Installing](#installing-1)
  - [Running](#running)
  - [Testing](#testing)
  - [Updating system firmware](#updating-system-firmware)
  - [Releasing a new version](#releasing-a-new-version)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


## Installing

For end-users, the most up-to-date installation instructions can be found here: [macOS / Linux](https://docs.particle.io/tutorials/developer-tools/cli/#using-macos-or-linux) | [Windows](https://docs.particle.io/tutorials/developer-tools/cli/#using-windows)


## Getting Started

These next two commands are all you need to get started setting up an account, claiming a device, and discovering new features.


### particle setup

Guides you through creating a new account, and claiming your device!

```sh
$ particle setup
```


### particle help

Shows you what commands are available, and how to use them.  You can also give the name of a command for detailed help.

```sh
$ particle help
$ particle help keys
```


## Updating Firmware


### Photon/P1/Electron


#### particle update

If you wish to easily update the system firmware running on your device to a later version, you can use the `particle update` command. For the exact version it will update to, check the version of the files in the [updates folder](/assets/updates).

1. Make sure you have [DFU-util](http://dfu-util.sourceforge.net/) installed.
1. Connect your device via USB, and put it into [DFU mode](https://docs.particle.io/guide/getting-started/modes/#dfu-mode-device-firmware-upgrade-).
1. Run `particle update`.


## Command Reference

For the full list of commands, please see the [CLI command reference](https://docs.particle.io/reference/cli/).


## Known Issues
* The Wireless Photon Setup Wizard will only automatically switch networks on OS X. Users of other operating systems will need to manually connect their computer to the Photon's Wi-Fi. You will be prompted during the wizard when this is required.


# Development


## Installing

1. Install Node.js [`node@8.x` and `npm@5.x` are required]
1. Clone this repository `$ git clone git@github.com:particle-iot/particle-cli.git && cd ./particle-cli`
1. Install dependencies `$ npm install`
1. View available commands `$ npm run`
1. Run the tests `$ npm test`
1. Run the CLI `$ npm start`
1. Start Hacking!


## Running

To ensure compatibility with a wide range of NodeJS versions, the CLI's source is transpiled using Babel.

**When developing, run individual commands using:**

`$ npm start -- <command> <options>` - e.g. `$ npm start -- library view dotstar --readme`

Anything after the `--` delimiter is passed directly to the CLI ([docs](https://docs.npmjs.com/cli/run-script)), source code is transpiled on-demand.


**To test the transpiled source as it will be published:**

1. Compile: `$ npm run compile`
1. Register the `particle` command globally: `$ npm link`
1. Run commands: `$ particle --help` (using standard argument formatting)


## Testing

The Particle CLI has a number of automated test suites and related commands. The most important are:

* `npm test` - run all tests (NOTE: [End-To-End tests require additional setup](https://github.com/particle-iot/particle-cli/tree/master/test/README.md))
* `npm run lint` - run the linter and print any errors to your terminal
* `npm run test:ci` - run all tests excluding device-dependent end-to-end test as CI does
* `npm run test:unit` - run unit tests
* `npm run test:integration` - run integration tests
* `npm run coverage` - report code coverage stats

All tests use [mocha](https://mochajs.org), [chai](https://www.chaijs.com), and [sinon](https://sinonjs.org/) with coverage handled by [nyc](https://github.com/istanbuljs/nyc).

We recommend running locally if you can as it greatly shortens your feedback loop. However, CI also runs against every PR and [error reporting is publicly available](https://travis-ci.org/particle-iot/particle-cli).


## Updating system firmware

- `npm run update-firmware-binaries <version>`
  where `<version>` is the newly released system firmware version like 0.7.0

- Test on each platform by doing

  ```
  # Check old firmware version
  bin/particle.js serial inspect

  # Flash new system firmware
  bin/particle.js update

  # Verify new firmware version
  bin/particle.js serial inspect
  ```

- Do not update the versions or CHANGELOG.md just yet!
- Commit as something like "adds firmware binaries for 0.7.0" and proceed to release a new CLI version (below).


## Releasing a new version

See [RELEASE.md](RELEASE.md).
