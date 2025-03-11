# Changelog

# 3.33.0 - Mar 10 2025
* Add commands to push apps to Tachyon and Linux devices

# 3.32.9 - Mar 07 2025
* Add --board option to pick specific package on setup

# 3.32.8 - Mar 06 2025
* Add --variant option to pick specific package on setup

# 3.32.7 - Feb 28 2025
* Fix login and product selection during Tachyon setup

# 3.32.6 - Feb 25 2025
* Allow provisioning esim even with existing profiles
* Add timezone during setup
* Prevent blank system password 
* Use local cache to esim profile checks
* Wait EDL device instead of fail if there is no device
* Improve error messaging on tachyon flashing

# 3.32.5 - Feb 19 2025
* fix qdl issues on Windows 

# 3.32.4 - Feb 18 2025
* Add region flag to download the right binary depending on the device
 
## 3.32.3 - Feb 11 2025
* Fix setup Tachyon password configuration when using load config file
* Fix setup Tachyon wifi password to return the right value

# 3.32.2 - Feb 10 2025
* Modify `esim provision` command to enable already downloaded profiles

# 3.32.1 - Feb 05 2025
* Add load config to Tachyon setup command
* Allow creating products with Tachyon setup command
* Add cache limit to Tachyon download directory

# 3.32.0 - Jan 28 2025
* Add Tachyon setup command

# 3.31.0 - Jan 17 2025
* Add progress bar when flashing Tachyon
* Include prototype esim provision command

# 3.30.3 - Dec 20  2024
* Update to latest qdl to flash files larger than 4 GB inside of zip files

# 3.30.2 - Dec 19  2024
* Update to latest qdl to support zip files larger than 4 GB

# 3.30.1 - Dec 19  2024
* Update to latest unzipper to support zip files larger than 4 GB

# 3.30.0 - Dec 18  2024
* Add support for flashing Tachyon

# 3.29.1 - Nov 29  2024
* Allow compiling by using archived Device OS versions

# 3.29.0 - Oct 17 2024
* Add `particle binary list-assets` and `particle binary strip-assets`

# 3.28.1 - Oct 10 2024
* Update message for when you aren't logged in for some cloud commands

# 3.28.0 - Oct 9 2024
* Remove the `particle token list` command
* Remove basic auth requirement from `particle token revoke` command
* Enforce current token deletion on `particle logout`
* Expose hidden `--org` flag for `particle logic-function` commands
* Update binary inspect to include UUID (app hash) in output
* Remove internal usage of access_token query params in favor of `Authorization` header

# 3.27.1 - Sep 11 2024
* Update actions/upload-artifact to v4

# 3.27.0 - Sep 11 2024
* Skip adding protected devices to non-protection products
* Use DeviceOS versions endpoint

# 3.26.0 - Aug 28 2024
* Add support for Protected Devices in CLI operations
* Add option to filter device with particle device-protection commands
* Remove particle setup command
* Update device constants for new display names and gen4

# 3.25.1 - Jul 18 2024
* Fix open url action on windows for `particle login --sso` command


# 3.25.0 - Jul 11 2024
* Added Device Protection feature

# 3.24.0 - Jun 4 2024
* Introduce new wifi setup process using `particle wifi` commands
* Add `particle usb network-interfaces` command
* Remove `--private` and `--public` option from `publish` args
* Handle failures for invalid CLI commands
* Add improvements to CI/CD process

# 3.23.6 - May 15 2024
* Fix ci deployment

# 3.23.5 - May 15 2024
* Update Readme and Release documents to reflect the new CLI package structure

# 3.23.4 - May 10 2024
* Fix unix installer to stop update check when installing specific version

# 3.23.3 - May 8 2024
* Fix update-cli command to find the current executable path to update

# 3.23.2 - May 8 2024
* Fix serial identify: show again IMEI and ICCID for all DVOS versions

# 3.23.1 - May 8 2024
* Fix assets flashing to accept renamed files

# 3.23.0 - May 8 2024
* Add new CLI package structure
* Add `particle update-cli --disable-updates` to disable update checks
* Add `particle update-cli --enable-updates` to enable update checks
* Add `particle update-cli --version` to update to a specific version

# 3.22.0 - Mar 26 2024
* Remove yeoman generator and use the new project structure
* Use `serial` to configure wifi devices
* Update `particle-commands` dependency to `1.0.1`

# 3.21.0 - Feb 14 2024
* Removes particle setup command which was used to setup photons
* Removes particle device doctor command and doctor is suggested to be used by docs
* Removes particle serial claim command
* Uses control requests to use the following commands so the user does not need to keep the device in listening mode
  * Device identify using particle serial identify
  * Device inspect using particle serial inspect now shows assets as well
  * Device mac address using particle serial mac
  * Configure Wifi using particle serial wifi

# 3.20.0 - Jan 30 2024

* Support devices in protected mode
* Replace serial mode flashing by local flashing

# 3.19.0 - Jan 12 2024

* Add `particle logic-funcction` namespace
* Add `particle logic-function list` command to list logic functions
* Add `particle logic-function get` command to get a logic function
* Add `particle logic-function create` command to create a logic function
* Add `particle logic-function execute` command to execute a logic function
* Add `particle logic-function deploy` command to deploy a logic function
* Add `particle logic-function enable` command to enable a logic function
* Add `particle logic-function disable` command to disable a logic function
* Add `particle logic-function delete` command to delete a logic function

# 3.18.1 - Dec 14 2023

* Dummy version same as 3.18.0

# 3.18.0 - Dec 1 2023

* Local flsher skips flashing assets which are already on the device
* Supports flashing monolithic firmware using `particle flash --local / --usb` commands
* Fix e2e tests

# 3.17.3 - Oct 19 2023

* Fix `particle flash --local` were not picking the deviceId from params
* Update `particle-commands` dependency to `0.5.3`

# 3.17.2 - Oct 17 2023

* Fix wrong message when attempting to run `particle update` | `particle flash` | `particle flash --local` without connected devices

# 3.17.1 - Oct 16 2023

* Add notes for e2e tests

# 3.17.0 - Oct 16 2023

* `particle flash --local` now works offline
* Device selector on `particle flash` `particle flash --local` `particle update` now retrieve more information
* Fix Pick wrong device to flash when multiple devices are connected
* `particle flash --usb` is aware of the required device mode depending on the binary
* Update `particle-usb` dependency to `2.4.1`

# 3.16.1 - Oct 2 2023

* Revert unintentional change to particle serial commands

# 3.16.0 - Sep 29 2023

* Ask user to manually switch to DFU for Device OS < 2.0.0
* Rework keys commands and remove usage of dfu-util

# 3.15.1 - Sep 26 2023

* Fix `particle flash --local` add retry logic for control request updates

# 3.15.0 - Sep 19 2023

* Rework `particle flash --usb` command to use the CLI flasher
* Invalidate 128k user part when required
* Use the latest version of `particle-api-js`
* Add notes for e2e tests

# 3.14.0 - Sep 6 2023

* Update command uses local flash and can target any Device OS version

# 3.13.0 - Aug 31 2023

* Support asset bundle size limitation

# 3.12.0 - Aug 21 2023

* Add local flash command with support for updating Device OS and flashing assets

## 3.11.3 - Jun 29 2023

* Rework particle bundle command to read project.propertie file

## 3.11.2 - Jun 23 2023

* Add support for project properties to bundle assets

## 3.11.1 - Jun 13 2023

* Rework functionality of particle.include and particle.ignore files

## 3.11.0 - Jun 1 2023

* Support for compile command to bundle assets and app binary
* Updated binaries for DeviceOS 4.1.0

## 3.10.2 - 19 May 2023

* Support for bundle command to bundle assets and app binary

## 3.10.1 - 16 May 2023

* Fix implementation of library upload so it works in Node 16

## 3.10.0 - 8 May 2023

* Update node version from `v12` to `v16`
* Update `serialport` dependencies

## 3.9.0 - 12 April 2023

* Add `login` with `sso` feature

## 3.8.1 - 5 April 2023

* Addressed renaming `Muon` -> `M SoM` platform

## 3.8.0 - 27 March 2023

* Add initial support for `muon` platform

## 3.7.0 - 21 December 2022

* Updated binaries for DeviceOS 4.0.2

## 3.6.0 - 16 November 2022

* Updated binaries for DeviceOS 4.0.1 and 2.3.1

## 3.5.0 - 30 August 2022

* Updated binaries for DeviceOS 4.0.0

## 3.4.0 - 11 August 2022

* Refactor project to no longer require a build step

## 3.3.3 - 21 July 2022

* More fixes to CI pipeline

## 3.3.2 - 20 July 2022

* Validate changes to CI pipeline

## 3.3.1 - 19 July 2022

* Fix `ERROR: Cannot find module './src/lib/platform'`

## 3.3.0 - 19 July 2022

* Improve `update` command: Flash using control requests, tune module update order so bootloader is first, automatically enter DFU mode when possible

## 3.2.0 - 7 June 2022

* Add initial support for new `esomx` and `trackerm` platforms
* Tune internal development tooling + CI/CD

## 3.1.0 - 16 January 2022

* Updated binaries for DeviceOS 2.3.0

## 3.0.0 - 9 December 2021

* BREAKING: Remove support for Redbear Duo. To use the CLI with a Duo, install the latest version 2: `npm install -g particle-cli@2`
* Pull platform information from a shared library

## 2.16.0 - 16 September 2021

* Clean up CI / CD misfire

## 2.15.0 - 16 September 2021

* Updated binaries for DeviceOS 2.2.0

## 2.14.0 - 13 July 2021

* Added first-time flash notice to inform users of potential latency related to [Safe Mode Healer](https://docs.particle.io/tutorials/device-os/device-os/#safe-mode-healer) ([PR #613](https://github.com/particle-iot/particle-cli/pull/613))

## 2.13.0 - 8 July 2021

* Remove deprecated `mesh` namespace and associated commands - for background, see: [docs](https://docs.particle.io/reference/discontinued/mesh/#what-happens-in-march-2021-), [blog post](https://blog.particle.io/mesh-deprecation/)

## 2.12.0 - 7 June 2021

* flash user applications into the location indicated by the module prefix
* bump `binary-version-reader` dependency to `v1.0.1`

## 2.11.0 - 29 April 2021

* Updated binaries for DeviceOS 2.1.0

## 2.10.1 - 24 March 2021

* Fix filtering by `platform` (e.g. `tracker`) in `particle usb list` command

## 2.10.0 - 17 December 2020

* Updated binaries for DeviceOS 2.0.1

## 2.9.1 - 8 December 2020

* `particle token list` command prompts for OTP to support users with MFA enabled ([PR #601](https://github.com/particle-iot/particle-cli/pull/601))

## 2.9.0 - 3 December 2020

* Fix intermittent failures with `particle flash --usb serial` on windows ([PR #598](https://github.com/particle-iot/particle-cli/pull/598))
* Silence `UnhandledPromiseRejectionWarning` and `Buffer() is deprecated` warnings
* Updated binaries for DeviceOS 2.0.0

## 2.8.2 - 16 November 2020

* Fix `particle flash --usb tinker` when targeting a `bsom` ([PR #596](https://github.com/particle-iot/particle-cli/pull/596))

## 2.8.1 - 18 August 2020

* Fix `particle doctor` destructuring error ([PR #591](https://github.com/particle-iot/particle-cli/pull/591))
* Fix `particle flash <my-device> tinker` when `<my-device>` is in a product ([PR #592](https://github.com/particle-iot/particle-cli/pull/592))

## 2.8.0 - 3 August 2020

* Add `particle product device remove` command to remove a device from a product (see `--help` for details)

## 2.7.2 - 13 July 2020

* Handle unresponsive devices when running `particle usb list`

## 2.7.1 - 9 July 2020

* improve api error messaging
* ensure `particle function call` respects the `--quiet` flag
* remove `silly!` in vaidation error messsage when prompting for `username`
* update wiring-preprocessor to `v2.2.0` to fix `enum class` syntax handling

## 2.7.0 - 26 May 2020

* Add `particle product` namespace
* Add `particle product device list` command to list devices in a product
* Add `particle product device add` command to facilitate adding device to a product
* Update `particle variable get` to accept `--product <id>` flag in order to fetch a variable from a product device
* Update `particle function call` to accept `--product <id>` flag in order to call a function on a product device
* Update `particle subscribe` to accept `--product <id>` flag in order to listen for events on a product device
* Update `particle publish` to accept `--product <id>` flag in order to send events to a product's event stream
* Update `particle cloud flash` to accept `--product <id>` flag in order to facilitate flashing a product device

_To learn more about these commands, append the `--help` flag and run the desired command - e.g. `particle product --help`_

## 2.6.0 - 20 May 2020

* Updated binaries for DeviceOS 1.5.2

## 2.5.0 - 6 May 2020

* Updated binaries for DeviceOS 1.5.1

## 2.4.1 - 5 May 2020

* Fix `particle usb list` when connected device(s) are not associated w/ signed-in account ([PR #580](https://github.com/particle-iot/particle-cli/pull/580))

## 2.4.0 - 4 May 2020

* Add `particle usb cloud-status` command to query the device via USB and return its cloud connection status ([PR #577](https://github.com/particle-iot/particle-cli/pull/577))
* Update `particle usb list` to optionally accept a `filter` param ([PR #564](https://github.com/particle-iot/particle-cli/pull/564))
* Update `particle subscribe` command w/ `--max` flag to exit after N events are received ([PR #563](https://github.com/particle-iot/particle-cli/pull/563))
* Update `particle subscribe` command w/ `--until` flag to exit after specifc event data is received ([PR #563](https://github.com/particle-iot/particle-cli/pull/563))
* Update `particle keys server` command to optionally save server keys locally when `--deviceType` flag is set ([PR #556](https://github.com/particle-iot/particle-cli/pull/556))
* Recognize Asset Tracker platform ([PR #579](https://github.com/particle-iot/particle-cli/pull/579))
* Fix `particle serial monitor --follow` exit signal event handling (`ctrl+c`, etc) ([PR #574](https://github.com/particle-iot/particle-cli/pull/574))
* Fix cloud compilation & flashing for `core` ([PR #569](https://github.com/particle-iot/particle-cli/pull/569))
* Fix `tinker` app flashing for `b5som` ([PR #576](https://github.com/particle-iot/particle-cli/pull/576))

## 2.3.0 - 30 March 2020

* Updated binaries for DeviceOS 1.5.0

## 2.2.0 - 3 March 2020

* Update `particle-usb` dependency so the `particle usb dfu` command confirms device is in DFU mode before exiting ([PR #555](https://github.com/particle-iot/particle-cli/pull/555))
* Update `wiring-preprocessor` dependency to have `Particle.h` included when running `particle preprocess` ([PR #554](https://github.com/particle-iot/particle-cli/pull/554))

## 2.1.1 - 7 February 2020

* Fix device transfer prompt in `particle cloud claim` command ([PR #549](https://github.com/particle-iot/particle-cli/pull/549))
* Clarify that `particle cloud claim` requires `deviceID`, always send lowercase id to the API ([PR #550](https://github.com/particle-iot/particle-cli/pull/550))

## 2.1.0 - 6 February 2020

* Display info about product firmware in `particle binary inspect` command ([PR #546](https://github.com/particle-iot/particle-cli/pull/546))
* Add a command `particle usb setup-done` to set and clear the "setup done" flag ([PR #547](https://github.com/particle-iot/particle-cli/pull/547))
* Recognize B5 SoM platform ([PR #548](https://github.com/particle-iot/particle-cli/pull/548))

## 2.0.1 - 19 December 2019

* `particle keys` commands handle file paths with spaces
* add text warning users to disconnect all but the target device when running `particle doctor`

## 2.0.0 - 11 December 2019

* drop support for `node@6`, add support for `node@12`. no other breaking changes.

## 2.0.0-rc.0 - 6 December 2019

* Initial release candidate for v2 - dropping support for `node@6` and adding support for `node@12`. no other breaking changes.

## 1.53.0 - 4 December 2019

* Updated binaries for DeviceOS 1.4.4

## 1.52.0 - 26 November 2019

* Updated binaries for DeviceOS 1.4.3

## 1.51.0 - 21 November 2019

* remove irrelevant `--delay` flag from `variable get` subcommand and alias
* fix --page flag handling in library list command
* library subcommands `search`, `list`, and `view` support optional `--json` flag to output JSON formatted data - _NOTE: Experimental! Use with caution and expect breaking changes_

## 1.50.0 - 5 November 2019

* Add option to set expiration time when creation API tokens

  Examples:

  ```bash
  # Token for 1 hour (3600 seconds)
  particle token create --expires-in 3600
  # Token that never expires (good for cloud applications)
  particle token create --never-expires
  ```
* Add `particle usb listen` as an alias to `particle usb start-listening`
* Fix `particle serial wifi` to now time out after 5 seconds if the device is not in USB listening mode.
* Fix spinner to now spin while commands like `partilce usb` and `particle mesh` are waiting.

## 1.49.0 - 18 October 2019

* Updated binaries for DeviceOS 1.4.2

## 1.48.0 - 16 October 2019

* Updated binaries for DeviceOS 1.4.1
* Electron DeviceOS binaries used for `particle update` are no longer built with `DEBUG_BUILD=y`

## 1.47.0 - 10 September 2019

* Updated binaries for DeviceOS 1.4.0

## 1.46.2 - 6 September 2019

* Fix “utilities.replaceAll is not a function” when running `particle keys server` using the `--host` flag
* Fix “Cannot read property ‘toLowerCase’ of undefined” when running `particle keys doctor`
* Update help text for `particle keys send` to specify device `id` is required
* Refine end-to-end `compile` assertions to improve reliability
* Add device-dependent end-to-end tests for `particle update`

## 1.46.1 - 6 September 2019

* Fix flaky end-to-end compilation test

## 1.46.0 - 6 September 2019

* Updated binaries for DeviceOS 1.3.1

## 1.45.0 - 29 August 2019

* Fixes issue "Cannot read property 'then' of undefined" w/ `particle doctor`
* Fixes long delay before exiting `particle flash --serial <bin>` command
* Fixes support for `particle.ignore` within legacy projects
* Optionally follow symlinks when collecting files for compilation - e.g. `particle compile argon --followSymlinks`
* Update help text for `particle keys doctor` to specify device `id` is required

## 1.44.0 - 29 August 2019

* Cloud compile and flash now accept `.hpp`, `.hxx`, and `.hh` files
* Update `particle-usb` to `v0.5.0` in preparation for `node@12` support
* Improved install / update instructions to reduce confusion for users of our wrapper bins
* `serial_follow_delay` setting uses default of 250ms (vs 5ms)
* Made `serialport` an _optional_ dependency

## 1.43.3 - 30 July 2019

* Resolves a regression introduced in 1.43.2 when flashing known applications e.g. tinker.

## 1.43.2 - 29 July 2019

* Support for radio stack modules and `DROP_MODULE_INFO` module flag [#493](https://github.com/particle-iot/particle-cli/pull/493)
* Support for secondary dependency in `particle binary inspect` [#493](https://github.com/particle-iot/particle-cli/pull/493)

## 1.43.1 - 16 July 2019

* Fixes issue #498 where `particle update` fails on Photon/P1 [#499](https://github.com/particle-iot/particle-cli/pull/499)

## 1.43.0 - 11 July 2019

* Updated binaries for Device OS 1.2.1
* Removed Ascender mechanism for updating bootloaders and replaced with shiny new 🌟 feature implemented in [Device OS PR 1788](https://github.com/particle-iot/device-os/pull/1788) that allows us to flash the bootloader via DFU with special sequence.

## 1.42.0 - 28 June 2019

* Updates bootloader on Photon and P1 to Device OS v1.1.1's latest version (v301), even though (v201) is only required. [#496](https://github.com/particle-iot/particle-cli/pull/496)
* Also updates all Device OS binaries to v1.1.1 [#496](https://github.com/particle-iot/particle-cli/pull/496)

## 1.41.2 - 10 June 2019
* Move `core-js` from `devDependencies` to `dependencies` (fixes [#491](https://github.com/particle-iot/particle-cli/issues/491))
* Update `wiring-preprocessor` to `v2.0.1`, show generated file warning when coverting `.ino` -> `.cpp`

## 1.41.1 - 29 May 2019
* Add `particle usb reset` support for devices in DFU mode [#488](https://github.com/particle-iot/particle-cli/pull/488)

## 1.41.0 - 14 May 2019

* Updates bootloader on Photon and P1 to Device OS v1.1.0's latest version (v301), even though (v201) is only required. [#487](https://github.com/particle-iot/particle-cli/pull/487)
* Also updates Photon/P1/Electron Device OS binaries to v1.1.0 [#487](https://github.com/particle-iot/particle-cli/pull/487)
* Adds `particle update` support for Gen 3 platforms [#487](https://github.com/particle-iot/particle-cli/pull/487)
* Show NCP firmware modules in the output of `serial inspect` [#477](https://github.com/particle-iot/particle-cli/pull/487)
* Mesh command fixes [#485](https://github.com/particle-iot/particle-cli/pull/487)

## 1.40.1 - 6 May 2019

* Overhaul build pipeline [#484](https://github.com/particle-iot/particle-cli/pull/484)
* Update dependencies [#482](https://github.com/particle-iot/particle-cli/pull/482), [#483](https://github.com/particle-iot/particle-cli/pull/483)

## 1.40.0 - 20 March 2019

* Add mesh commands (`particle mesh`) [#473](https://github.com/particle-iot/particle-cli/pull/473)
* Add USB utility commands (`particle usb`) [#473](https://github.com/particle-iot/particle-cli/pull/473)
* Add Gen 3 devices and Particle debuggers to the udev rules file [#473](https://github.com/particle-iot/particle-cli/pull/473)
* Detect if the installed udev rules file needs to be updated [#473](https://github.com/particle-iot/particle-cli/pull/473)

## 1.39.0 - 19 February 2019

* Add a flag to force serial flash without prompt [#471](https://github.com/particle-iot/particle-cli/pull/471)
* Add binaries for Device OS 1.0.1 [#476](https://github.com/particle-iot/particle-cli/pull/476)

## 1.38.0 - 24 January 2019

* Use different server key variant for Gen 3 devices in particle keys server [#470](https://github.com/particle-iot/particle-cli/pull/470)
* Support Gen 3 SoMs in compile, DFU mode and serial mode [#470](https://github.com/particle-iot/particle-cli/pull/470)

## 1.37.0 - 10 January 2019

* Add Device OS 1.0 [#469](https://github.com/particle-iot/particle-cli/pull/469)
* Fix comma insertion in preprocess command [#468](https://github.com/particle-iot/particle-cli/pull/468)

## 1.36.3 - 19 December 2018

* Revert support Argon, Boron, Xenon in `particle update` [#467](https://github.com/particle-iot/particle-cli/pull/467)

## 1.36.2 - 19 December 2018

* Fix tinker for Photon, P1, Argon, Boron, Xenon [#465](https://github.com/particle-iot/particle-cli/pull/465)
* Support Argon, Boron, Xenon in `particle update` [#465](https://github.com/particle-iot/particle-cli/pull/465)
* Fix timeout when flashing Argon NCP firmware over serial [#465](https://github.com/particle-iot/particle-cli/pull/465)

## 1.36.1 - 18 December 2018

* Fix to stop spinner after running `particle login --token XXXX` [#464](https://github.com/particle-iot/particle-cli/pull/464)

## 1.36.0 - 13 December 2018

* Add support for Gen 3 bootloader and NCP to `particle binary inspect` [#461](https://github.com/particle-iot/particle-cli/pull/461)

## 1.35.2 - 16 October 2018

* Fix cloud flash --target option handling [#453](https://github.com/particle-iot/particle-cli/pull/453)

## 1.35.1 - 29 September 2018

* Fix mesh device key addresses [#452](https://github.com/particle-iot/particle-cli/pull/452)

## 1.35.0 - 28 September 2018

* Support mesh devices in cloud flash and DFU [#451](https://github.com/particle-iot/particle-cli/pull/451)

## 1.34.0 - 10 September 2018

* Default arguments to strings [#449](https://github.com/particle-iot/particle-cli/pull/449)
* Add command to preprocess ino file [#450](https://github.com/particle-iot/particle-cli/pull/450)

## 1.33.0 - 6 August 2018

* Add support for two-step authentication in CLI [#441](https://github.com/particle-iot/particle-cli/pull/441) [#442](https://github.com/particle-iot/particle-cli/pull/442)

## 1.32.3 - 3 July 2018

* REVERT switch from `package-lock.json` to `npm-shrinkwrap.json` [#437](https://github.com/particle-iot/particle-cli/pull/437)

## 1.32.3 - 3 July 2018

* switch from `package-lock.json` to `npm-shrinkwrap.json` [#436](https://github.com/particle-iot/particle-cli/pull/436)

## 1.32.2 - 1 July 2018

* pin `serialport` to 6.2.0 to avoid installation issues on Windows [#435](https://github.com/particle-iot/particle-cli/pull/435)

## 1.32.1 - 25 June 2018

* fix "Cannot read property 'stop' of undefined" in whoami command [#433](https://github.com/particle-iot/particle-cli/pull/433)

## 1.32.0 - 25 June 2018

* fix server error when particle function returns `0`, only show time for variable when `--time` flag is set [#431](https://github.com/particle-iot/particle-cli/pull/431)
* fix handling of `dir` param and `--name` flag in `project create` command [#429](https://github.com/particle-iot/particle-cli/pull/429)
* handle `--username`, `--password`, and `--token` flags in `login` command [#428](https://github.com/particle-iot/particle-cli/pull/428)
* add `whoami` command to see currently signed-in username [#430](https://github.com/particle-iot/particle-cli/pull/430)

## 1.31.0 - 18 June 2018

* Improve error handling [#422](https://github.com/particle-iot/particle-cli/pull/422)
* Document the update-cli command [#425](https://github.com/particle-iot/particle-cli/pull/425)
* Remove Electron flash data warning [#426](https://github.com/particle-iot/particle-cli/pull/426)

## 1.30.0 - 4 June 2018

* Include binaries for firmware 0.7.0 (with bootloader updater "ascender" app for Photon/P1)[#408](https://github.com/particle-iot/particle-cli/pull/418)

## 1.29.0 - 26 March 2018

* Include binaries for firmware 0.7.0

## 1.28.2 - 21 March 2018

* [#405](https://github.com/particle-iot/particle-cli/pull/405) Add back capability to configure Wi-Fi over serial using a JSON file
* Fix crash when changing account in `particle setup`

## 1.28.1 - 8 March 2018

* Add missing alias `particle identify` => `particle serial identify`

## 1.28.0 - 8 March 2018

* [#403](https://github.com/particle-iot/particle-cli/pull/403) Move all commands to the new argument parser and rework the help

## 1.27.0 - 22 January 2018

* Handle API errors when fetching the claim code

## 1.27.0 - 5 December 2017

* Fix --yes for flash with binary

## 1.26.2 - 30 November 2017

* Include binaries for firmware 0.6.4 [Electron only]

## 1.26.1 - 29 November 2017

* [#392](https://github.com/spark/particle-cli/pull/392) Migrate from serialport v4 to v6

## 1.25.0 - 7 November 2017

* Include binaries for firmware 0.6.3

## 1.24.1 - 12 September 2017

- [#386](https://github.com/spark/particle-cli/issues/386) Increase Device Doctor timeout for clearing EEPROM

## 1.24.0 - 29 August 2017

- [#379](https://github.com/spark/particle-cli/pull/379) Add `particle device doctor`

## 1.23.1 - 6 July 2017

- [#375](https://github.com/spark/particle-cli/issues/375) Fix for `particle setup wifi`.

## 1.23.0 - 30 June 2017

- Support for WPA Enterprise Wi-Fi setup

## 1.22.0 - 3 May 2017

* Include binaries for firmware 0.6.2

## 1.21.0 - 29 March 2017

## Features

* [#353](https://github.com/spark/particle-cli/pull/353) Wi-Fi switching on Windows
* [#351](https://github.com/spark/particle-cli/pull/351) Library publish without a name
* White list files when uploading library to avoid publishing unnecessary files

## 1.20.1 - 1 March 2017

* Include binaries for firmware 0.6.1

## 1.19.4 - 7 Febrary 2017

 * Fix: Use release version of particle-library-manager

## 1.19.3 - 7 February 2017

## Features

 * [#338](https://github.com/spark/particle-cli/pull/338) - `particle keys protocol` displays the currently configured protocol for the connected device
 * [#205](https://github.com/spark/particle-cli/pull/205) - `webhook delete all` command. Thanks @kennethlimcp!
 * [#240](https://github.com/spark/particle-cli/pull/240) - `particle serial monitor --follow' reconnects to the serial port when the device resets. Thanks @derekmpeterson!
 * [#225](https://github.com/spark/particle-cli/pull/225) - ability to specify a .json file to skip the wifi prompts. Thanks @markterrill!
 * `--no-update-check` to skip checks for updated versions

## Fixes

 * [#326](https://github.com/spark/particle-cli/issues/326) - unhandled rejection in `help`
 * [#235](https://github.com/spark/particle-cli/issues/235) - Unhandled error in `particle setup`
 * [#331](https://github.com/spark/particle-cli/issues/331) - Flashing a known app causes exception
 * [#328](https://github.com/spark/particle-cli/issues/328) - ParticleCLISetup for Windows broken due to OpenSSL download problem
 * [#326](https://github.com/spark/particle-cli/issues/326) - Unhandled rejection in help
 * [#321](https://github.com/spark/particle-cli/issues/321) - keys doctor (device id) is case sensitive
 * [#292](https://github.com/spark/particle-cli/issues/292) - this -> self
 * [#280](https://github.com/spark/particle-cli/issues/280) - Incorrect key pulled for Electron using TCP
 * [#279](https://github.com/spark/particle-cli/issues/279) - Server key address output incorrect for Electron using TCP
 * [#231](https://github.com/spark/particle-cli/issues/231) -  max retry for wifi scan error
 * [#299](https://github.com/spark/particle-cli/pull/299) - update glob dependency to avoid warning about minimatch vulnerability. Thanks @snyk-bot.


#r 1.19.2 - 26 January 2017

* Fix path for compiling library examples

## 1.19.1 - 23 January 2017

* Tweak for Windows CLI installer

## 1.19.0 - 23 January 2017

* Library commands. Try `particle library`

## 1.18.0 - 22 November 2016

* Include binaries for firmware 0.6.0

## 1.17.2 - 17 November 2016

* Disable update check through environment

## 1.17.1 - 11 November 2016

* Add support for Raspberry Pi

## 1.17.0 - 30 September 2016

### Updates

* Include binaries for firmware 0.5.3

### Fixes

* Fix a crash at startup when running without a tty

## 1.16.0 - 5 August 2016

### Updates

* Support DFU flashing 3-part Electron system firmware (0.6.0 and later)

## 1.15.0 - 7 July 2016

### Updates

* Include binaries for firmware 0.5.2
* Add Oak and Bluz platforms

## 1.14.2 - 1 June 2016

## Fixes

* Fix flashing binaries to Electron over the air

## 1.14.1 - 31 May 2016

## Fixes

* Use tarball instead of git dependency to be able to install on computers without git
* Fix particle compile with --saveTo flag

## 1.14.0 - 27 May 2016

### Updates

* Include binaries for firmware 0.5.1

### Fixes

* Fix incorrect platform id error when doing a DFU flash for Core ([#232](https://github.com/spark/particle-cli/issues/232))
* Able to OTA flash binary files again ([#251](https://github.com/spark/particle-cli/issues/251))

## 1.13.0 - 25 May 2016

### New Features

* Photon WiFi setup on Linux. ([#209](https://github.com/spark/particle-cli/pr/209))
* Compile code in sub-directories ([#248](https://github.com/spark/particle-cli/pr/248))

### Updates

* Serial port package updated to version 3.1.1 for compatibility with Node.js v6. Thanks @nfriedly! ([#244](https://github.com/spark/particle-cli/pr/244))

### Fixes

* Better error message when renaming devices. Thanks @derekmpeterson ([#238](https://github.com/spark/particle-cli/pr/238))
* Remove debug output from `particle keys send`. Thanks @derekmpeterson! ([#239](https://github.com/spark/particle-cli/pr/239))

## 1.12.0 - 21 Apr 2016

### New Features

* Add `udp listen` command. ([#220](https://github.com/spark/particle-cli/issues/220))

### Updates

* Add `0.5.0` update binaries for Electron, Photon, and P1.
* Add Redbear Duo to known platform list.
* Add a debugging version of tinker for Electrons that logs AT commands over serial.

### Fixes

* Better DFU util error handling. ([#206](https://github.com/spark/particle-cli/issues/206))
* Fix usage of `Buffer.fill` on older versions of node. ([#224](https://github.com/spark/particle-cli/issues/224))

## 1.11.0 - 10 Feb 2016

### New Features

* Prompt for confirmation of OTA data usage, when flashing cellular devices.

### Fixes

* Handle invalid token for `subscribe` commands. ([#207](https://github.com/spark/particle-cli/issues/207))
* Lowercase device id output during `setup`. ([#208](https://github.com/spark/particle-cli/issues/208))
* Increase specific error to ignore during `update`. ([#206](https://github.com/spark/particle-cli/issues/206))

## 1.10.0 - 27 Jan 2016

### New Features

* Add `serial flash` command and `flash --serial` mode to flash firmware over serial using the YMODEM protocol. ([#200](https://github.com/spark/particle-cli/pull/200))
* Add compile version targeting using `--target` argument. `compile` and `flash` both support this argument, when compiling via the cloud. ([#183](https://github.com/spark/particle-cli/issues/183))
* Add support for `proxyUrl` settings to be used when communicating with the Particle Cloud. ([#108](https://github.com/spark/particle-cli/issues/108))
* Prompt to request a transfer, if needed, when claiming a device. ([#114](https://github.com/spark/particle-cli/issues/114))
* Change to `0.4.9` update binaries used by the `particle update` command for Photon and P1.

### Fixes

* Fix serial device detection on Linux. Thanks [@monkbroc](https://github.com/monkbroc)! ([#190](https://github.com/spark/particle-cli/issues/190))
* Fix `help` command output that was missing information in some cases.
* Fix timeout error during `setup wifi` on Cores. ([#144](https://github.com/spark/particle-cli/issues/144))
* Standardize Wi-Fi question order. ([#19](https://github.com/spark/particle-cli/issues/19))
* Fix `list` if no devices are found.
* Generate keys with `keys new` if no DFU device found but `--protocol` specified.
* Make binary downloads after `compile` more reliable.

## 1.9.3 - 20 Jan 2016

### Fixes

* Do not fail DFU commands if any `stderr` output is generated.

## 1.9.2 - 16 Jan 2016

### Fixes

* Fix `node-wifiscanner2` not reporting any SSID results on non-`en` locales in Windows. Thanks [@ScruffR](https://github.com/ScruffR)! ([#118](https://github.com/spark/particle-cli/issues/118))

## 1.9.1 - 15 Jan 2016

### Fixes

* Fix `leave` being left off the DFU command when flashing user application firmware.
* Remove excess `console.log`
* Fix system version display during `identify` for Electrons

## 1.9.0 - 14 Jan 2016

### New Features

* `keys address` command to read protocol, host, and port configured on a device for the cloud.
* `keys protocol` command to switch cloud transport protocol between `tcp` and `udp` for devices that support it.
* `binary inspect` command to parse a firmware binary and output module information.
* `serial inspect` command to read module information from the device, parse, and display it. ([#76](https://github.com/spark/particle-cli/issues/76))
* `list` output can now be filtered using `online`, `offline`, device type, or device id/name. ([#96](https://github.com/spark/particle-cli/issues/96))
* Firmware binaries are now parsed and sent to the correct device address. This allows you to flash system parts with `flash --usb` now. Incorrect usage is prevented, but can be overridden with `--force`. ([#159](https://github.com/spark/particle-cli/issues/159))
* Check for updates - particle-cli now checks to see if you have the latest version from npm, at most once a day, and outputs a message if not.([#138](https://github.com/spark/particle-cli/issues/138))
* Cloud public keys are included and can be flashed by invoking `keys server` with no arguments. ([#70](https://github.com/spark/particle-cli/issues/70))
* Support across the board for ECC keys used with the UDP cloud protocol on the Electron. Most `keys` commands now support `--protocol udp` and `--protocol tcp`, but will default to what is appropriate for the device.

### Enhancements

* Add system firmware version to `identify` command. ([#95](https://github.com/spark/particle-cli/issues/95))
* Improve bad token handling. ([#193](https://github.com/spark/particle-cli/issues/193))
* Enable auto-detection of variable name versus device id during `variable get` and `variable monitor`. ([#187](https://github.com/spark/particle-cli/issues/187))
* Use device attributes to determine platform for flashing apps. ([#151](https://github.com/spark/particle-cli/issues/151))
* Output detected Wi-Fi security type. ([#126](https://github.com/spark/particle-cli/issues/126))
* Add option for manual entry if no Wi-Fi networks are detected. ([#121](https://github.com/spark/particle-cli/issues/121))
* Add `webhook` documentation to README. ([#29](https://github.com/spark/particle-cli/issues/29))
* Add support for `--product_id` to `keys send` command. ([#155](https://github.com/spark/particle-cli/issues/155))
* Improve API error handling.
* Improve device claiming output. ([#152](https://github.com/spark/particle-cli/issues/152))

### Fixes

* Fix URL for DFU install instructions. ([#191](https://github.com/spark/particle-cli/issues/191))
* Check arguments for `udp send`, `token revoke`. ([#185](https://github.com/spark/particle-cli/issues/185), [#180](https://github.com/spark/particle-cli/issues/180))
* Backspace will no longer erase console output. ([#20](https://github.com/spark/particle-cli/issues/20))
* Handle errors from `softap-setup-js` during `setup`. ([#154](https://github.com/spark/particle-cli/issues/154))
* Filter Photon SSIDs from available list during `serial wifi`. ([#135](https://github.com/spark/particle-cli/issues/135))
* Filter directories from list of files to compile during `compile`. ([#177](https://github.com/spark/particle-cli/issues/177))
* Remove documentation for invalid `flash` argument combinations. ([#115](https://github.com/spark/particle-cli/issues/115))
* Show error when trying to flash a directory over USB. ([#142](https://github.com/spark/particle-cli/issues/142))

### Updates

* Electron firmware binaries to 0.4.8-rc.6

## 12/23/2015 - 1.8.22

* New firmware release for electron

## 12/21/2015 - 1.8.21

* 21 on the 21st!  Fixing small bug that impacted webhook creation.

## 12/16/2015 - 1.8.20

* Fix cloud compile error output. Improve error code reporting in several places.

## 12/15/2015 - 1.8.19

* Fix cloud compiling error

## 12/14/2015 - 1.8.18

* Fix early returns from promise using commands

## 12/14/2015 - 1.8.17

* Update Electron binaries to v0.0.3-rc.3

## 11/03/2015 - 1.8.16

* Add `bluz` to cloud compile platforms

## 10/30/2015 - 1.8.15

* Update Electron binaries to v0.0.3-rc.2

## 10/23/2015 - 1.8.14

* Add Electron update binaries and tinker. Add IMEI/ICCID serial parsing.

## 10/21/2015 - 1.8.13

* Update node-serialport dependency to require 2.0.1 or later.

## 10/20/2015 - 1.8.12

* Update system firmware to 0.4.7 for Photon/P1.

## 10/12/2015 - 1.8.11

* Include voodoospark v3.1.1 binary. Update package.json engines requirement.

## 10/12/2015 - 1.8.10

* Forgot to publish update to README removing mention of Node 4.x incompatibility.

## 10/12/2015 - 1.8.9

* Include v2.0 of node-serialport. This makes the Particle CLI compatible with Node v4.x!

## 10/04/2015 - 1.8.8

* Include voodoospark v3.1.0 binary.

## 10/02/2015 - 1.8.7

* revert Electron modular settings and update binaries.

## 10/02/2015 - 1.8.6

* Include voodoospark v3.0.0 binary.

## 10/01/2015 - 1.8.5

* Update system firmware to 0.4.6 for Photon/P1.

## 09/30/2015 - 1.8.4

* Add Electron update binaries and tinker.

## 09/12/2015 - 1.8.3

* Fix Photon claiming.

## 09/11/2015 - 1.8.2

* Critical fix to system firmware 0.4.5

## 09/11/2015 - 1.8.1

* Update system firmware to 0.4.5

## 09/11/2015 - 1.8.0

* Add Electron setup. Update event publish description.

## 09/09/2015 - 1.7.0

* Handle optional serial wifi prompt for cipher type. Add version to help commands. Add P1 tinker to known apps. Display Electron label in device list. Fix webhook type information being lost. Upgrade node-wifiscanner2 to work in more locales.

## 08/26/2015 - 1.6.9

* Re-add fixed P1 serial support. Fix device MAC address detection.

## 08/25/2015 - 1.6.8

* Revert serial changes

## 08/25/2015 - 1.6.7

* Add serial support for P1

## 08/25/2015 - 1.6.6

* Add support for P1 cloud compiling from CLI

## 08/23/2015 - 1.6.5

* Fix variable monitor. Warn if connected to Photon AP when starting setup. Fail if device name contains spaces. Add support for manual mode when scanning but not connecting works. Ask for device name when setting up a photon. Use child_process.spawn to avoid password prompts on OS X.

## 08/20/2015 - 1.6.4

* Update system firmware to 0.4.4

## 08/18/2015 - 1.6.3

* Fix verbose DFU output. Fix config value deletion. Handle network scan security type missing. Handle trailing slashes in api url. Select first Wi-Fi port instead of hard-coded (OS X). Check for correct error from API when a token is invalid

## 08/17/2015 - 1.6.2

* Fix Win10 device detection with default USB serial driver

## 08/06/2015 - 1.6.1

* Update system firmware binaries

## 08/06/2015 - 1.6.0

* Add tests. Add system firmware updating.

## 08/04/2015 - 1.5.20

* Fix known app paths. Remove unused promise.

## 07/25/2015 - 1.5.19

* Add known apps to device specs

## 07/24/2015 - 1.5.18

* Add missing semicolons

## 07/24/2015 - 1.5.17

* Format flash output. Use sudo correctly when necessary. Validate SSID entry. Update README with device_type args to compile command. Fix docs links. Update dfu-util links. Ask for device type when flashing. Fix Wi-Fi reconnection.

## 07/06/2015 - 1.5.16

* Fix core setup

## 07/06/2015 - 1.5.15

* update to use "flashDevice"

## 06/26/2015 - 1.5.14

* fix cloud flash command

## 06/26/2015 - 1.5.13

* keys command fixes and update colour to be blindness friendly

## 06/26/2015 - 1.5.12

* Webhook fixes

## 05/28/2015 - 1.5.11

* Fix core setup

## 05/21/2015 - 1.5.10

* Fix tiny but important typo in prompts around manual Wi-Fi credentials.

## 05/21/2015 - 1.5.9

* Added manual Wi-Fi credential mode. If your Wi-Fi network is non-broadcast, or if you'd just rather avoid scanning for networks, you can choose to manually enter your network details.

## 05/15/2015 - 1.5.2

* Fixed a visual formatting bug of markdown on the README

## 05/15/2015 - 1.5.1

* Fixed DFU specification regression causing users to be unable to locally flash keys and firmware to Photons.

## 05/15/2015 - 1.5.0

* Rebranding complete! This project is now known as particle-cli

## 05/14/2015 - 1.4.1

* Fixed error handling on Wireless Photon setup routine.

## 05/14/2015 - 1.4.0

* Introduce support for Photon setup on OS X. New UI implementation for setup and wireless commands. Deprecating spark-cli in favor of the particle-cli as part of Spark's rebranding to Particle. Future releases will be under the 'particle-cli' package.

## 03/03/2015 - 1.0.0

* introduce token commands by Kyle Marsh, documentation preparation for Photon release, merged js/ and doc/ directories, firmed up semantic versioning for dependencies, converted to hard tabs.

## 01/13/2015 - 0.4.94

* fixing spark.include not being considered for builds

## 01/09/2015 - 0.4.93

* reverting patcher for the moment by popular demand

## 12/16/2014 - 0.4.92

* oops, real "1.14" patcher, cc3000 should report version 1.32

## 12/16/2014 - 0.4.91

* adding new patcher that pulls latest patch from TI, 1.14

## 12/09/2014 - 0.4.8

* pushing out patches and pull requests

## 12/03/2014 - 0.4.7

* upgrading Voodoospark (2.6.0)

## 11/24/2014 - 0.4.6

* adding glob support for include / ignore files, and both files are now processed!  Also only pulling in source files by default (*.h, *.cpp, *.c, *.ino) - fixed a ton of issues (#60, #97, #66, #84, #89, #90, #95)

## 11/17/2014 - 0.4.5

* new version of Voodoospark (2.5.0) requested in #105, yay!

## 10/22/2014 - 0.4.4

* new tinker, version 11

## 10/13/2014 - 0.4.3

* bringing in pull requests #92, #93, #98, fixing issues #91, #80, #83, #88, #87, bringing in contributors from 2014

## 10/07/2014 - 0.4.2

* test for spark vendorid in findcores

## 09/10/2014 - 0.4.1

* new tinker!  Version 10 - second try

## 09/10/2014 - 0.4.0

* new tinker!  Version 10

## 09/03/2014 - 0.3.99

* new webhook parameters and features, still in beta, but coming soon!

## 08/22/2014 - 0.3.98

* new tinker binary! Version 9

## 08/05/2014 - 0.3.97

* new tinker binary!  Version 8

## 07/29/2014 - 0.3.96

* adding a helper in the event capitalization is wrong on config settings

## 07/22/2014 - 0.3.95

* adding config command

## 07/18/2014 - 0.3.94

* adding latest tinker binary

## 07/17/2014 - 0.3.93

* adding latest deep_update binary

## 07/02/2014 - 0.3.91

* fixing a cloud flash file handling bug

## 06/29/2014 - 0.3.9

* fixing a bug where a bin file in a directory would cause the CLI to stop looking for source files when compiling.

## 06/23/2014 - 0.3.8

* adding "--factory" option for spark flash, to more easily rewrite the factory reset firmware area, a bunch of little fixes, and a new 'spark list' output format

## 06/05/2014 - 0.3.7

* adding `deep_update_2014_06` known app, to help with patching cores that aren't able to patch wirelessly

## 05/28/2014 - 0.3.6

* adding version to general help, incorporating voodoospark pull request

## 05/28/2014 - 0.3.5

* various bug fixes - fixing "undefined" variables, instead of proper count

## 05/27/2014 - 0.3.4

* Allowing comment lines prefixed with "#" in spark.include and spark.ignore

## 05/27/2014 - 0.3.3

* Fixing a flashing binary bug - don't conclude binary file argument is an output bin unless it's preceded by other filenames.

## 05/27/2014 - 0.3.2

* Okay! The command structure got a bit of a remodel, use ```spark help``` to see the new commands. Pro-Tip!  If you don't like the new command structure, the old commands should still mostly work, and you can remove the new commands entirely by adding ```commandMappings: null``` to your settings overrides file (which is here: ~/.spark/spark.config.json ).  There have also been lots of small bug fixes and improvements. Also, the new mappings.json file paves the way for language support for command descriptions and help in languages other than english.  Please feel free to send in translations! :)

* Includes Fixes for #30, #36, pr #35, #32, #39

## 04/28/2014 - 0.3.1

* New node-serialport that doesn't need to be compiled, yay!  Please check the github readme for new commands :) Includes Fixes for #21, #5, #30, pr #27, pr #29,

## 03/19/2014 - 0.3.0

* Clarifying language, fixing some prompts

## 03/18/2014 - 0.2.99

* Adding 'subscribe' for streaming SSE from Spark.publish

## 03/17/2014 - 0.2.98

* fixing a bug where we used the wrong parser

## 03/17/2014 - 0.2.97

* Add a serial find override for /dev/ttyACM if we don't find any cores advertised on serial

## 03/17/2014 - 0.2.96

* Fixing #18, backwards compatibility for wifi config

## 03/17/2014 - 0.2.95

* Improving the guided setup user account behaviors

## 03/16/2014 - 0.2.94

* Adding a guided setup command, lots of small tweaks

## 03/07/2014 - 0.2.93

* Merging in a patch that helps with using Serial on Windows

## 03/03/2014 - 0.2.92

* Adding basic function call support

## 03/02/2014 - 0.2.9

* Merged in pull request for #6, and #14, fixed #3, #9, and #10,

* Also removed hard dependency on ursa so the build / install is easier.

## 02/21/2014 - 0.2.8

* Adding cloud list

## 02/21/2014 - 0.2.7

* Adding local dfu flash

## 02/21/2014 - 0.2.6

* Adding Udp client helper

## Initial Release! - 02/20/2014

  So this is _very_ new software.  We haven't even peeled off the protective plastic film yet.
  There will be bugs, and I hope you'll help us find them and add suggestions along the way.

# Notes

* Please feel free to submit issues, pull requests, comments, suggestions, and more at the repository https://github.com/spark/particle-cli
* You can find documentation on Particle here: http://docs.particle.io/
* You can post and find answers on the forums here: http://community.particle.io/
* Or you can find us on IRC at freenode #particle
