changelog
=========
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


* Please feel free to submit issues, pull requests, comments, suggestions, and more at the repository https://github.com/spark/spark-cli
* You can find documentation on Spark here: http://docs.spark.io/
* You can post and find answers on the forums here: http://community.spark.io/
* Or you can find us on IRC at freenode #spark

