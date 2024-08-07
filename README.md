[![npm](https://img.shields.io/npm/v/particle-cli.svg?style=flat-square)](https://www.npmjs.com/package/particle-cli) ![GitHub Actions](https://github.com/particle-iot/particle-cli/actions/workflows/dev.yml/badge.svg?branch=master) [![License](https://img.shields.io/badge/license-Apache_2.0-blue.svg?style=flat-square)](https://github.com/particle-iot/particle-cli/blob/master/LICENSE)

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
  - [Releasing a new version](#releasing-a-new-version)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->


## Installing

For end-users, the most up-to-date installation instructions can be found here: [macOS / Linux](https://docs.particle.io/tutorials/developer-tools/cli/#using-macos-or-linux) | [Windows](https://docs.particle.io/tutorials/developer-tools/cli/#using-windows)

Note: Some commands may require `openssl` to be installed on your system.
You can install it using your package manager (e.g. `brew install openssl` on macOS).

### Installing a staging version
Before proceeding with this section,
remember that the staging version may contain bugs and issues that are not present in the production version.

***Please use the staging versions only for testing purposes.***

In case you're running macOS or Linux, you can install a staging version of the CLI by running the following command:
```bash
  MANIFEST_HOST=binaries.staging.particle.io bash <(curl -sL https://particle.io/install-cli)
```

For Windows,
you can install a staging version of the CLI
by downloading the installer from [here](https://binaries.staging.particle.io/particle-cli/installer/win32/ParticleCLISetup.exe).

In case you have already installed the CLI, you can update it to the staging version by running the following command:
```bash
  export PARTICLE_MANIFEST_HOST=binaries.staging.particle.io
  particle update-cli --version {STAGING_VERSION_TO_TEST}
```
Don't forget to turn off the updates to prevent issues while you're testing the staging version:
```bash
  particle update-cli --disable-updates
```

Once you're done testing the staging version, you can revert to the production version by running the following command:
```bash
  export PARTICLE_MANIFEST_HOST=binaries.particle.io
  particle update-cli --enable-updates
  particle update-cli
```


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

### particle update

If you wish to easily update Device OS on your device to a later version, you can use the `particle update` command.
You can specify a version with the `--target` argument.

1. Connect your device via USB
1. Run `particle update`.


## Command Reference

For the full list of commands, please see the [CLI command reference](https://docs.particle.io/reference/cli/).


## Known Issues
* The Wireless Photon Setup Wizard will only automatically switch networks on OS X. Users of other operating systems will need to manually connect their computer to the Photon's Wi-Fi. You will be prompted during the wizard when this is required.


# Development

_Currently development is supported on macOS only!_


## Installing

1. Install Node.js [`node@16.x` and `npm@8.x` are required]
1. Clone this repository `$ git clone git@github.com:particle-iot/particle-cli.git && cd ./particle-cli`
1. Install external tools: `openssl` (e.g. `brew install openssl`)
1. Install dependencies `$ npm install`
1. View available commands `$ npm run`
1. Run the tests `$ npm test`
1. Run the CLI `$ npm start`
1. Start Hacking!


## Running

**When developing, run individual commands using:**

`$ npm start -- <command> <options>` - e.g. `$ npm start -- library view dotstar --readme`

Anything after the `--` delimiter is passed directly to the CLI ([docs](https://docs.npmjs.com/cli/run-script)).


**To test the source as it will be published:**

1. Register the `particle` command globally: `$ npm link`
2. Run commands: `$ particle --help` (using standard argument formatting)


## Testing

The Particle CLI has a number of automated test suites and related commands. The most important are:

* `npm test` - run all tests (NOTE: [End-To-End tests require additional setup](https://github.com/particle-iot/particle-cli/tree/master/test/README.md))
* `npm run lint` - run the linter and print any errors to your terminal
* `npm run test:ci` - run all tests excluding device-dependent end-to-end test as CI does
* `npm run test:unit` - run unit tests
* `npm run test:integration` - run integration tests
* `npm run coverage` - report code coverage stats

All tests use [mocha](https://mochajs.org), [chai](https://www.chaijs.com), and [sinon](https://sinonjs.org/) with coverage handled by [nyc](https://github.com/istanbuljs/nyc).

We recommend running locally if you can as it greatly shortens your feedback loop.
However, CI also runs against every PR and [error reporting
is publicly available](https://app.circleci.com/pipelines/github/particle-iot/particle-cli).

## CLI Packaging and Distribution
* Cli is packaged using [pkg](https://github.com/vercel/pkg).
The packaging is done using GitHub Actions
  and the executables are uploaded to [binaries.particle.io/particle-cli](https://binaries.particle.io/particle-cli/).
* There are two installers that are created for the CLI:
  * Windows installer: `particle-cli-setup.exe` (This is an NSIS installer for Windows).
    You can see the installer script here [ParticleCLISetup.nsi](installer/windows/ParticleCLISetup.nsi)
  * Unix installer: `install-cli` (This is a shell script that installs the CLI on Unix systems).
    You can see the installer script here [install-cli.sh](installer/unix/install-cli)
* The installers are created using GitHub Actions and are uploaded to [binaries.particle.io/particle-cli/installer](https://binaries.particle.io/particle-cli/installer).
* The current supported platforms for the CLI are:
  * Windows
    * x64
  * macOS
    * x64
    * arm64
  * Linux
    * x64
    * arm64
    * arm
## Releasing a new version

See [RELEASE.md](RELEASE.md).
