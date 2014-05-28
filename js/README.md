changelog
=========

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

