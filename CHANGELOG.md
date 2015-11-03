changelog
=========
11/03/2015 - 1.8.16 - Add `bluz` to cloud compile platforms

10/30/2015 - 1.8.15 - Update Electron binaries to v0.0.3-rc.2

10/23/2015 - 1.8.14 - Add Electron update binaries and tinker. Add IMEI/ICCID serial parsing.

10/21/2015 - 1.8.13 - Update node-serialport dependency to require 2.0.1 or later.

10/20/2015 - 1.8.12 - Update system firmware to 0.4.7 for Photon/P1.

10/12/2015 - 1.8.11 - Include voodoospark v3.1.1 binary. Update package.json engines requirement.

10/12/2015 - 1.8.10 - Forgot to publish update to README removing mention of Node 4.x incompatibility.

10/12/2015 - 1.8.9 - Include v2.0 of node-serialport. This makes the Particle CLI compatible with Node v4.x!

10/04/2015 - 1.8.8 - Include voodoospark v3.1.0 binary.

10/02/2015 - 1.8.7 - revert Electron modular settings and update binaries.

10/02/2015 - 1.8.6 - Include voodoospark v3.0.0 binary.

10/01/2015 - 1.8.5 - Update system firmware to 0.4.6 for Photon/P1.

09/30/2015 - 1.8.4 - Add Electron update binaries and tinker.

09/12/2015 - 1.8.3 - Fix Photon claiming.

09/11/2015 - 1.8.2 - Critical fix to system firmware 0.4.5

09/11/2015 - 1.8.1 - Update system firmware to 0.4.5

09/11/2015 - 1.8.0 - Add Electron setup. Update event publish description.

09/09/2015 - 1.7.0 - Handle optional serial wifi prompt for cipher type. Add version to help commands. Add P1 tinker to known apps. Display Electron label in device list. Fix webhook type information being lost. Upgrade node-wifiscanner2 to work in more locales.

08/26/2015 - 1.6.9 - Re-add fixed P1 serial support. Fix device MAC address detection.

08/25/2015 - 1.6.8 - Revert serial changes

08/25/2015 - 1.6.7 - Add serial support for P1

08/25/2015 - 1.6.6 - Add support for P1 cloud compiling from CLI

08/23/2015 - 1.6.5 - Fix variable monitor. Warn if connected to Photon AP when starting setup. Fail if device name contains spaces. Add support for manual mode when scanning but not connecting works. Ask for device name when setting up a photon. Use child_process.spawn to avoid password prompts on OS X.

08/20/2015 - 1.6.4 - Update system firmware to 0.4.4

08/18/2015 - 1.6.3 - Fix verbose DFU output. Fix config value deletion. Handle network scan security type missing. Handle trailing slashes in api url. Select first Wi-Fi port instead of hard-coded (OS X). Check for correct error from API when a token is invalid

08/17/2015 - 1.6.2 - Fix Win10 device detection with default USB serial driver

08/06/2015 - 1.6.1 - Update system firmware binaries

08/06/2015 - 1.6.0 - Add tests. Add system firmware updating.

08/04/2015 - 1.5.20 - Fix known app paths. Remove unused promise.

07/25/2015 - 1.5.19 - Add known apps to device specs

07/24/2015 - 1.5.18 - Add missing semicolons

07/24/2015 - 1.5.17 - Format flash output. Use sudo correctly when necessary. Validate SSID entry. Update README with device_type args to compile command. Fix docs links. Update dfu-util links. Ask for device type when flashing. Fix Wi-Fi reconnection.

07/06/2015 - 1.5.16 - Fix core setup

07/06/2015 - 1.5.15 - update to use "flashDevice"

06/26/2015 - 1.5.14 - fix cloud flash command

06/26/2015 - 1.5.13 - keys command fixes and update colour to be blindness friendly

06/26/2015 - 1.5.12 - Webhook fixes

05/28/2015 - 1.5.11 - Fix core setup

05/21/2015 - 1.5.10 - Fix tiny but important typo in prompts around manual Wi-Fi credentials.

05/21/2015 - 1.5.9 - Added manual Wi-Fi credential mode. If your Wi-Fi network is non-broadcast, or if you'd just rather avoid scanning for networks, you can choose to manually enter your network details.

05/15/2015 - 1.5.2 - Fixed a visual formatting bug of markdown on the README

05/15/2015 - 1.5.1 - Fixed DFU specification regression causing users to be unable to locally flash keys and firmware to Photons.

05/15/2015 - 1.5.0 - Rebranding complete! This project is now known as particle-cli

05/14/2015 - 1.4.1 - Fixed error handling on Wireless Photon setup routine.

05/14/2015 - 1.4.0 - Introduce support for Photon setup on OS X. New UI implementation for setup and wireless commands. Deprecating spark-cli in favor of the particle-cli as part of Spark's rebranding to Particle. Future releases will be under the 'particle-cli' package.

03/03/2015 - 1.0.0 - introduce token commands by Kyle Marsh, documentation preparation for Photon release, merged js/ and doc/ directories, firmed up semantic versioning for dependencies, converted to hard tabs.

01/13/2015 - 0.4.94 - fixing spark.include not being considered for builds

01/09/2015 - 0.4.93 - reverting patcher for the moment by popular demand

12/16/2014 - 0.4.92 - oops, real "1.14" patcher, cc3000 should report version 1.32

12/16/2014 - 0.4.91 - adding new patcher that pulls latest patch from TI, 1.14

12/09/2014 - 0.4.8 - pushing out patches and pull requests

12/03/2014 - 0.4.7 - upgrading Voodoospark (2.6.0)

11/24/2014 - 0.4.6 - adding glob support for include / ignore files, and both files are now processed!  Also only pulling in source files by default (*.h, *.cpp, *.c, *.ino) - fixed a ton of issues (#60, #97, #66, #84, #89, #90, #95)

11/17/2014 - 0.4.5 - new version of Voodoospark (2.5.0) requested in #105, yay!

10/22/2014 - 0.4.4 - new tinker, version 11

10/13/2014 - 0.4.3 - bringing in pull requests #92, #93, #98, fixing issues #91, #80, #83, #88, #87, bringing in contributors from 2014

10/07/2014 - 0.4.2  - test for spark vendorid in findcores

09/10/2014 - 0.4.1  - new tinker!  Version 10 - second try

09/10/2014 - 0.4.0  - new tinker!  Version 10

09/03/2014 - 0.3.99 - new webhook parameters and features, still in beta, but coming soon!

08/22/2014 - 0.3.98 - new tinker binary! Version 9

08/05/2014 - 0.3.97 - new tinker binary!  Version 8

07/29/2014 - 0.3.96 - adding a helper in the event capitalization is wrong on config settings

07/22/2014 - 0.3.95 - adding config command

07/18/2014 - 0.3.94 - adding latest tinker binary

07/17/2014 - 0.3.93 - adding latest deep_update binary

07/02/2014 - 0.3.91 - fixing a cloud flash file handling bug

06/29/2014 - 0.3.9 - fixing a bug where a bin file in a directory would cause the CLI to stop looking for source files when compiling.

06/23/2014 - 0.3.8 - adding "--factory" option for spark flash, to more easily rewrite the factory reset firmware area
  a bunch of little fixes, and a new 'spark list' output format

06/05/2014 - 0.3.7 - adding "deep_update_2014_06" known app, to help with patching cores that aren't able to patch wirelessly

05/28/2014 - 0.3.6 - adding version to general help, incorporating voodoospark pull request
05/28/2014 - 0.3.5 - various bug fixes - fixing "undefined" variables, instead of proper count
05/27/2014 - 0.3.4 - Allowing comment lines prefixed with "#" in spark.include and spark.ignore
05/27/2014 - 0.3.3 - Fixing a flashing binary bug - don't conclude binary file argument is an output bin unless it's preceded by other filenames.

05/27/2014 - 0.3.2 - Okay! The command structure got a bit of a remodel, use ```spark help``` to see the new commands.
  Pro-Tip!  If you don't like the new command structure, the old commands should still mostly work, and you
  can remove the new commands entirely by adding ```commandMappings: null``` to your settings overrides file
  (which is here: ~/.spark/spark.config.json ).  There have also been lots of small bug fixes and improvements.
  Also, the new mappings.json file paves the way for language support for command descriptions and help in languages
  other than english.  Please feel free to send in translations! :)

  Includes Fixes for #30, #36, pr #35, #32, #39

04/28/2014 - 0.3.1 - New node-serialport that doesn't need to be compiled, yay!  Please check the github readme for new
  commands :)
  Includes Fixes for #21, #5, #30, pr #27, pr #29,

03/19/2014 - 0.3.0 - Clarifying language, fixing some prompts
03/18/2014 - 0.2.99 - Adding 'subscribe' for streaming SSE from Spark.publish
03/17/2014 - 0.2.98 - fixing a bug where we used the wrong parser

03/17/2014 - 0.2.97 - Add a serial find override for /dev/ttyACM if we don't find any cores advertised on serial
03/17/2014 - 0.2.96 - Fixing #18, backwards compatibility for wifi config
03/17/2014 - 0.2.95 - Improving the guided setup user account behaviors
03/16/2014 - 0.2.94 - Adding a guided setup command, lots of small tweaks
03/07/2014 - 0.2.93 - Merging in a patch that helps with using Serial on Windows
03/03/2014 - 0.2.92 - Adding basic function call support

03/02/2014 - 0.2.9 - Merged in pull request for #6, and #14, fixed #3, #9, and #10,

  Also removed hard dependency on ursa so the build / install is easier.
  (Issues are listed here: https://github.com/spark/spark-cli/issues?state=open )

02/21/2014 - 0.2.8 - Adding cloud list
02/21/2014 - 0.2.7 - Adding local dfu flash

02/21/2014 - 0.2.6 - Adding Udp client helper


Initial Release! - 02/20/2014

  So this is _very_ new software.  We haven't even peeled off the protective plastic film yet.
  There will be bugs, and I hope you'll help us find them and add suggestions along the way.


* Please feel free to submit issues, pull requests, comments, suggestions, and more at the repository https://github.com/spark/particle-cli
* You can find documentation on Particle here: http://docs.particle.io/
* You can post and find answers on the forums here: http://community.particle.io/
* Or you can find us on IRC at freenode #particle
