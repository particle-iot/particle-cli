spark-cli
=========

Spark Command Line Interface for the Cloud


Install
=======

  Make sure you have node installed!  http://nodejs.org/

  Then it's as easy as:

    npm install -g spark-cli
    spark cloud login

Upgrade
=======
To upgrade Spark-CLI, enter the following command:

    npm update -g spark-cli

Getting Started / Documentation
===============

###spark setup

``` > spark setup```

  Guides you through creating a new account, and claiming your core!


###spark cloud login

``` > spark cloud login ```

  Login and save an access token for interacting with your account on the Spark Cloud.


###spark cloud list

``` > spark cloud list ```

  Pulls a list of what cores you own, and displays information about their status


###spark cloud claim

``` > spark cloud claim 0123456789ABCDEFGHI  ```

  Claim a new core onto your current account


###spark cloud name

``` > spark cloud name 0123456789ABCDEFGHI "pirate frosting" ```

  Assigns a new name to a core you've claimed


###spark cloud flash

    > spark cloud flash 0123456789ABCDEFGHI core-firmware.bin
    > spark cloud flash 0123456789ABCDEFGHI my_application.ino
    > spark cloud flash 0123456789ABCDEFGHI /projects/big_app/src

  Send a firmware binary, a source file, or a directory of source files to your core.


###spark cloud compile

    > spark cloud compile my_application.ino
    > spark cloud compile /projects/big_app/src
    > spark cloud compile main.ino SomeLib.h SomeLib.cpp OtherStuff.h
    > spark cloud compile main.ino SomeLib.h SomeLib.cpp OtherStuff.h output.bin
    > spark cloud compile main.ino SomeLib.h SomeLib.cpp OtherStuff.h --saveTo ~/output.bin

  Create and download a firmware binary, by cloud compiling a source file, or a directory of source files


###spark flash firmware

``` > spark flash firmware core-firmware.bin ```

  When your core is flashing yellow (in dfu mode), and connected to your computer, flash your binary locally over USB.


###spark variable list

``` > spark variable list ```

  Gets a list of all your cores and the exposed variables of the cores that are online.


###spark variable get

    > spark variable get 0123456789ABCDEFGHI temperature
    > spark variable get all temperature

  Retrieves the value of that variable from one or all cores


###spark variable monitor

    > spark variable monitor 0123456789ABCDEFGHI temperature 5000
    > spark variable monitor 0123456789ABCDEFGHI temperature 5000 --time
    > spark variable monitor all temperature 5000
    > spark variable monitor all temperature 5000 --time
    > spark variable monitor all temperature 5000 --time > my_temperatures.csv

  Pulls the value of a variable at a set interval, and optionally display a timestamp
  
  * Minimum delay for now is 500 (there is a check anyway if you keyed anything less)
  * "ctrl + c" in the console stops the monitoring

###spark function list

``` > spark function list ```

  Gets a list of all your cores and the exposed functions of the cores that are online.


###spark function call

    > spark function call
    > spark function call 0123456789ABCDEFGHI functionName "Here is my string"

  Call a particular function on your core, and show the return value


###spark serial list

``` > spark serial list ```

  Shows currently connected Spark Core's acting as serial devices over USB

###spark serial monitor

    > spark serial monitor
    > spark serial monitor 1
    > spark serial monitor COM3
    > spark serial monitor /dev/cu.usbmodem12345

  Starts listening to the specified serial device, and echoes to the terminal


###spark serial wifi

    > spark serial wifi
    > spark serial wifi 1
    > spark serial wifi COM3
    > spark serial wifi /dev/cu.usbmodem12345

  Helpful shortcut for configuring Wi-Fi credentials over serial when your core is connected and in listening mode (flashing blue)

###spark serial identify

    > spark serial identify
    > spark serial identify 1
    > spark serial identify COM3
    > spark serial identify /dev/cu.usbmodem12345

  Retrieves your core id when the core is connected and in listening mode (flashing blue)


###spark keys doctor

``` > spark keys doctor 0123456789ABCDEFGHI```

  Runs a series of steps to generate a new public/private keypair, and send it to the server for your core.  Helpful
  for recovering from key issues.


###spark subscribe

    > spark subscribe
    > spark subscribe mine
    > spark subscribe eventName
    > spark subscribe eventName mine
    > spark subscribe eventName CoreName
    > spark subscribe eventName 0123456789ABCDEFGHI


  Subscribes to published events on the cloud, and pipes them to the console.  Special core name "mine" will subscribe
  to events from just your cores.

