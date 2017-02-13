[![npm](https://img.shields.io/npm/v/particle-cli.svg?style=flat-square)](https://www.npmjs.com/package/particle-cli)[![Build Status](https://img.shields.io/travis/spark/particle-cli.svg?style=flat-square)](https://travis-ci.org/spark/particle-cli)[![Code Coverage](https://img.shields.io/coveralls/spark/particle-cli.svg?style=flat-square)](https://coveralls.io/github/spark/particle-cli)[![License](https://img.shields.io/badge/license-LGPL-blue.svg?style=flat-square)](https://github.com/spark/particle-cli/blob/master/LICENSE)

# Particle CLI

The Particle CLI is a powerful tool for interacting with your devices and the Particle Cloud.  The CLI uses [node.js](http://nodejs.org/) and can run on Windows, Mac OS X, and Linux.  It's also [open source](https://github.com/spark/particle-cli) so you can edit and change it, and even send in your changes as [pull requests](https://help.github.com/articles/using-pull-requests) if you want to share!

## Known Issues
* The Wireless Photon Setup Wizard will only automatically switch networks on OS X. Users of other operating systems will need to manually connect their computer to the Photon's Wi-Fi. You will be prompted during the wizard when this is required.

## Installing

#### If you've previously installed the old version of this package,```spark-cli```, please uninstall it before continuing.
#### Simply type: ```npm uninstall -g spark-cli``` into the command line.

For the most up-to-date installation instructions, including Windows installer, see [CLI - Installation](https://docs.particle.io/guide/tools-and-features/cli/photon/#installing) on our documentation site.



## Running from source (advanced)

To grab the CLI source and play with it locally

```sh
git clone git@github.com:spark/particle-cli.git
cd particle-cli
npm install
node bin/particle help
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of Contents

- [Getting Started](#getting-started)
  - [particle setup](#particle-setup)
  - [particle help](#particle-help)
- [Updating Firmware](#updating-firmware)
  - [Photon/P1/Electron](#photonp1electron)
    - [particle update](#particle-update)
  - [Core](#core)
    - [Apply the CC3000 patch](#apply-the-cc3000-patch)
    - [Performing a "Deep update"](#performing-a-deep-update)
- [Command Reference](#command-reference)
  - [particle setup wifi](#particle-setup-wifi)
  - [particle login](#particle-login)
  - [particle logout](#particle-logout)
  - [particle list](#particle-list)
  - [particle device add](#particle-device-add)
  - [particle device rename](#particle-device-rename)
  - [particle device remove](#particle-device-remove)
  - [particle flash](#particle-flash)
    - [Flashing a directory](#flashing-a-directory)
    - [Flashing one or more source files](#flashing-one-or-more-source-files)
    - [Flashing a known app](#flashing-a-known-app)
    - [Compiling remotely and Flashing locally](#compiling-remotely-and-flashing-locally)
  - [particle compile](#particle-compile)
    - [compiling against a particular system firmware target](#compiling against a particular system firmware target)
    - [compiling a directory](#compiling-a-directory)
    - [example particle.include](#example-particleinclude)
    - [example particle.ignore](#example-particleignore)
    - [Compiling one or more source files](#compiling-one-or-more-source-files)
    - [Compiling in a directory containing project files](#compiling-in-a-directory-containing-project-files)
  - [particle call](#particle-call)
  - [particle get](#particle-get)
  - [particle monitor](#particle-monitor)
  - [particle identify](#particle-identify)
  - [particle subscribe](#particle-subscribe)
  - [particle publish](#particle-publish)
  - [particle serial list](#particle-serial-list)
  - [particle serial monitor](#particle-serial-monitor)
  - [particle serial flash](#particle-serial-flash)
  - [particle keys doctor](#particle-keys-doctor)
  - [particle keys new](#particle-keys-new)
  - [particle keys load](#particle-keys-load)
  - [particle keys save](#particle-keys-save)
  - [particle keys send](#particle-keys-send)
  - [particle keys server](#particle-keys-server)
    - [Encoding a server address and port](#encoding-a-server-address-and-port)
  - [particle keys address](#particle-keys-address)
  - [particle keys protocol](#particle-keys-protocol)
  - [particle config](#particle-config)
  - [particle binary inspect file.bin](#particle-binary-inspect-filebin)
  - [particle webhook](#particle-webhook)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

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

If you wish to easily update the system firmware running on your device to a later version, you can use the `particle update` command. For the exact version it will update to, check the version of the files in the [updates folder](https://github.com/spark/particle-cli/tree/master/updates).

1. Make sure you have [DFU-util](http://dfu-util.sourceforge.net/) installed.
1. Connect your device via USB, and put it into [DFU mode](https://docs.particle.io/guide/getting-started/modes/#dfu-mode-device-firmware-upgrade-).
1. Run `particle update`.


# Development

## Releasing a new version

- `npm version <major | minor | patch>`

This increments the major, minor or patch version respectively. Before
the command finishes, update `CHANGELOG.md`.

- `git push && git push --tag`

- `npm publish`

- Create a release on GitHub with the notes from the `CHANGELOG.md`

## Updating system firmware

- `npm run update-firmware-binaries <version>`
  where `<version>` is the newly released system firmware version like 0.6.0

- Test on each platform by doing
```
# Check old firmware version
bin/particle.js serial inspect
# Flash new system firmware
bin/particle.js update
# Verify new firmware version
bin/particle.js serial inspect
```

- Commit and release a new CLI version.
