Spark CLI
==========

The Spark CLI is a powerful tool for interacting with your cores and the Spark Cloud.  The CLI uses [node.js](http://nodejs.org/) and can run on Windows, Mac OS X, and Linux fairly easily.  It's also [open source](https://github.com/spark/spark-cli) so you can edit and change it, and even send in your changes as [pull requests](https://help.github.com/articles/using-pull-requests) if you want to share!

Installing
=======

  First, make sure you have [node.js](http://nodejs.org/) installed!  

  Next, open a command prompt or terminal, and install by typing:

```sh 
$ npm install -g spark-cli
$ spark cloud login
```

Install (advanced)
---------------------------

To use the local flash and key features you'll need to install [dfu-util](http://dfu-util.gnumonks.org/), and [openssl](http://www.openssl.org/).  They are freely available and open-source, and there are installers and binaries for most major platforms as well.  

Here are some great tutorials on the community for full installs:

[Installing on Ubuntu](https://community.spark.io/t/how-to-install-spark-cli-on-ubuntu-12-04/3474)

[Installing on Windows](https://community.spark.io/t/tutorial-spark-cli-on-windows-06-may-2014/3112)


Upgrading
---------------------------
To upgrade Spark-CLI, enter the following command:

```sh
$ npm update -g spark-cli
```


Running from source (advanced)
---------------------------
To grab the CLI source and play with it locally

```sh
git clone git@github.com:spark/spark-cli.git
cd spark-cli/js
node app.js help
```


Getting Started
===============

  These next two commands are all you need to get started setting up an account, claiming a core, and discovering new features.


###spark setup

  Guides you through creating a new account, and claiming your core!

```sh
$ spark setup
```


###spark help

  Shows you what commands are available, and how to use them.  You can also give the name of a command for detailed help.
  
```sh
$ spark help
$ spark help keys 
```



Performing a "Deep update"
================

  Any core shipped before Summer 2014 would benefit from having this update applied at least once.  It improves the core's performance on very busy networks, and helps fix other minor issues.  This update now ships with the cli so you can apply it to cores that are unable to get online otherwise.

1.) Make sure you have [dfu-util](http://dfu-util.gnumonks.org/) installed

2.) Connect your core via usb, and place it into dfu mode by holding both buttons, and releasing reset, keep holding mode until your core flashes yellow.

3.) Run ```spark flash --usb deep_update_2014_06```

4.) Your core should reboot and try to connect to any previously saved wifi networks, and then update itself again.


Command Reference
================

###spark setup wifi

  Helpful shortcut for adding another wifi network to a core connected over USB.  Make sure your core is connected via a USB cable, and is slow blinking blue [listening mode](http://docs.spark.io/#/connect)

```sh
$ spark setup wifi
```


###spark login

  Login and save an access token for interacting with your account on the Spark Cloud.

```sh
$ spark login
```


###spark logout

  Logout and optionally revoke the access token for your CLI session.

```sh
$ spark logout
```


###spark list

  Generates a list of what cores you own, and displays information about their status, including what variables and functions are available

```sh
$ spark list

Checking with the cloud...
Retrieving cores... (this might take a few seconds)
my_core_name (0123456789ABCDEFGHI) 0 variables, and 4 functions
  Functions:
    int digitalWrite(string)
    int digitalRead(string)
    int analogWrite(string)
    int analogRead(string)

```


###spark core add

  Adds a new core to your account

```sh 
$ spark cloud claim 0123456789ABCDEFGHI
Claiming core 0123456789ABCDEFGHI
Successfully claimed core 0123456789ABCDEFGHI
```


###spark core rename

  Assigns a new name to a core you've claimed

```sh
$ spark core rename 0123456789ABCDEFGHI "pirate frosting"
```



###spark core remove

  Removes a core from your account so someone else can claim it.

```sh
$ spark core remove 0123456789ABCDEFGHI
Are you sure?  Please Type yes to continue: yes
releasing core 0123456789ABCDEFGHI
server said  { ok: true }
Okay!
```


###spark flash

  Sends a firmware binary, a source file, or a directory of source files, or a known app to your core.

  Note!  When sending source code, the cloud compiles ```.ino``` and ```.cpp``` files differently.  For ```.ino``` files, the cloud will apply a pre-processor.  It will add missing function declarations, and it will inject an ```#include "
  application.h"``` line at the top of your files if it is missing.

  If you want to build a library that can be used for both Arduino and Spark, here's a useful code snippet:

```cpp
#if defined(ARDUINO) && ARDUINO >= 100
#include "Arduino.h"
#elif defined(SPARK)
#include "application.h"
#endif
```


####Flashing a directory

  You can setup a directory of source files and libraries for your project, and the CLI will use those when compiling remotely.  You can also create ```spark.include``` and / or a ```spark.ignore``` file in that directory that will tell the CLI specifically which files to use or ignore.

```sh
$ spark flash 0123456789ABCDEFGHI my_project
```


####Flashing one or more source files

  You can include any number of individual source files after the device id, and the CLI will include them while flashing your app.


```sh
$ spark flash 0123456789ABCDEFGHI app.ino library1.cpp library1.h
```


####Flashing a known app

  You can easily reset a core back to a previous existing app with a quick command. Three app names are reserved right now: "tinker", "voodoo", and "cc3000".  Tinker is the original firmware that ships with the core, and cc3000 will patch the wifi module on your Core. Voodoo is a build of [VoodooSpark](http://voodoospark.me/) to allow local wireless firmata control of a core.

```sh
$ spark flash 0123456789ABCDEFGHI tinker
$ spark flash 0123456789ABCDEFGHI cc3000
$ spark flash 0123456789ABCDEFGHI voodoo
```


####Compiling remotely and Flashing locally

To work locally, but use the cloud compiler, simply use the compile command, and then the local flash command after.  Make sure you connect your core via USB and place it into [dfu mode](http://docs.spark.io/#/connect/appendix-dfu-mode-device-firmware-upgrade).

```sh
$ spark compile my_project_folder --saveTo firmware.bin
OR
$ spark compile app.ino library1.cpp library1.h --saveTo firmware.bin
$ spark flash --usb firmware.bin
```


###spark compile

  Compiles one or more source file, or a directory of source files, and downloads a firmware binary.

  Note!  The cloud compiles ```.ino``` and ```.cpp``` files differently.  For ```.ino``` files, the cloud will apply a pre-processor.  It will add missing function declarations, and it will inject an ```#include "
  application.h"``` line at the top of your files if it is missing.

  If you want to build a library that can be used for both Arduino and Spark, here's a useful code snippet:

```cpp
#if defined(ARDUINO) && ARDUINO >= 100
#include "Arduino.h"
#elif defined(SPARK)
#include "application.h"
#endif
```


####compiling a directory

  You can setup a directory of source files and libraries for your project, and the CLI will use those when compiling remotely.  You can also create ```spark.include``` and / or a ```spark.ignore``` file in that directory that will tell the CLI specifically which files to use or ignore.  Those files are just plain text with one line per filename

```sh
$ spark compile my_project_folder
```


####example spark.include
```text
application.cpp
library1.h
library1.cpp
```


####example spark.ignore
```text
.ds_store
logo.png
old_version.cpp
```


####Compiling one or more source files

  You can include any number of individual source files after the device id, and the CLI will include them while compiling your app.


```sh
$ spark compile app.ino library1.cpp library1.h
```




###spark call

  Calls a function on one of your cores, use ```spark list``` to see which cores are online, and what functions are available.

```sh
$ spark call 0123456789ABCDEFGHI digitalWrite "D7,HIGH"
1
```


###spark get

  Retrieves a variable value from one of your cores, use ```spark list``` to see which cores are online, and what variables are available.

```sh
$ spark get 0123456789ABCDEFGHI temperature
72.1
```



###spark monitor

  Pulls the value of a variable at a set interval, and optionally display a timestamp
  
  * Minimum delay for now is 500 (there is a check anyway if you keyed anything less)
  * hitting ```CTRL + C``` in the console will exit the monitoring

```sh
$ spark monitor 0123456789ABCDEFGHI temperature 5000
$ spark monitor 0123456789ABCDEFGHI temperature 5000 --time
$ spark monitor all temperature 5000
$ spark monitor all temperature 5000 --time
$ spark monitor all temperature 5000 --time > my_temperatures.csv
```


###spark identify

  Retrieves your core id when the core is connected via USB and in listening mode (flashing blue).

```sh
$ spark identify
$ spark identify 1
$ spark identify COM3
$ spark identify /dev/cu.usbmodem12345

$ spark identify
0123456789ABCDEFGHI
```

###spark subscribe

  Subscribes to published events on the cloud, and pipes them to the console.  Special core name "mine" will subscribe to events from just your cores.


```sh 
$ spark subscribe
$ spark subscribe mine
$ spark subscribe eventName
$ spark subscribe eventName mine
$ spark subscribe eventName CoreName
$ spark subscribe eventName 0123456789ABCDEFGHI
```




###spark serial list

  Shows currently connected Spark Core's acting as serial devices over USB

```sh
$ spark serial list
```


###spark serial monitor

  Starts listening to the specified serial device, and echoes to the terminal

```sh
$ spark serial monitor
$ spark serial monitor 1
$ spark serial monitor COM3
$ spark serial monitor /dev/cu.usbmodem12345
```


###spark keys doctor

Helps you update your keys, or recover your core when the keys on the server are out of sync with the keys on your core.  The ```spark keys``` tools requires both dfu-util, and openssl to be installed.

Connect your core in [dfu mode](http://docs.spark.io/#/connect/appendix-dfu-mode-device-firmware-upgrade), and run this command to replace the unique cryptographic keys on your core.  Automatically attempts to send the new public key to the cloud as well.

```sh
$ spark keys doctor 0123456789ABCDEFGHI
```


###spark keys new

Generates a new public / private keypair that can be used on a core.

```sh
$ spark keys new
running openssl genrsa -out core.pem 1024
running openssl rsa -in core.pem -pubout -out core.pub.pem
running openssl rsa -in core.pem -outform DER -out core.der
New Key Created!

$ spark keys new mykey
running openssl genrsa -out mykey.pem 1024
running openssl rsa -in mykey.pem -pubout -out mykey.pub.pem
running openssl rsa -in mykey.pem -outform DER -out mykey.der
New Key Created!
```

###spark keys load

Copies a ```.DER``` formatted private key onto your core's external flash.  Make sure your core is connected and in [dfu mode](http://docs.spark.io/#/connect/appendix-dfu-mode-device-firmware-upgrade).  The ```spark keys``` tools requires both dfu-util, and openssl to be installed.  Make sure any key you load is sent to the cloud with ```spark keys send core.pub.pem```

```sh
$ spark keys load core.der
...
Saved!
```

###spark keys save

Copies a ```.DER``` formatted private key from your core's external flash to your computer.  Make sure your core is connected and in [dfu mode](http://docs.spark.io/#/connect/appendix-dfu-mode-device-firmware-upgrade).  The ```spark keys``` tools requires both dfu-util, and openssl to be installed.

```sh
$ spark keys save core.der
...
Saved!
```

###spark keys send

Sends a core's public key to the cloud for use in opening an encrypted session with your core.  Please make sure your core has the corresponding private key loaded using the ```spark keys load``` command.

```sh
$ spark keys send 0123456789ABCDEFGHI core.pub.pem
submitting public key succeeded!
```

###spark keys server

Switches the server public key stored on the core's external flash.  This command is important when changing which server your core is connecting to, and the server public key helps protect your connection.   Your core will stay in DFU mode after this command, so that you can load new firmware to connect to your server.

Coming Soon - more commands to make it easier to change the server settings on your core!


```sh
$ spark keys server my_server.der
Okay!  New keys in place, your core will not restart.
```

