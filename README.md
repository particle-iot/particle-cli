[![Build Status](https://travis-ci.org/spark/particle-cli.svg)](https://travis-ci.org/spark/particle-cli)
[![Open Issues](https://img.shields.io/github/issues/spark/particle-cli.svg)](https://github.com/spark/particle-cli/issues)
[![License](https://img.shields.io/badge/license-LGPL-blue.svg)](https://github.com/spark/particle-cli/blob/master/LICENSE)

Particle CLI
==========

The Particle CLI is a powerful tool for interacting with your devices and the Particle Cloud.  The CLI uses [node.js](http://nodejs.org/) and can run on Windows, Mac OS X, and Linux fairly easily.  It's also [open source](https://github.com/spark/particle-cli) so you can edit and change it, and even send in your changes as [pull requests](https://help.github.com/articles/using-pull-requests) if you want to share!

Known Issues
========
* The Wireless Photon Setup Wizard will only automatically switch networks on OS X. Users of other operating systems will need to manually connect their computer to the Photon's Wi-Fi. You will be prompted during the wizard when this is required.

Installing
=======

#### If you've already installed ```spark-cli```, please uninstall it before continuing.
#### Simply type: ```npm uninstall -g spark-cli``` into the command line.

  First, make sure you have [node.js](http://nodejs.org/) installed!

  Next, open a command prompt or terminal, and install by typing:

```sh
$ npm install -g particle-cli
$ particle cloud login
```

  *Note!*  If you have problems running this, make sure you using Terminal / the Command Prompt as an Administator, or try using ```sudo```

```sh
$ sudo npm install -g particle-cli
```


Install (advanced)
---------------------------

To use the local flash and key features you'll need to install [DFU-util](http://DFU-util.sourceforge.net/) and [openssl](http://www.openssl.org/).  They are freely available and open-source, and there are installers and binaries for most major platforms as well.

Here are some great tutorials on the community for full installs:

[Installing on Ubuntu](https://community.particle.io/t/how-to-install-spark-cli-on-ubuntu-12-04/3474)

[Installing on Windows](https://community.particle.io/t/tutorial-spark-cli-on-windows-06-may-2014/3112)

#### Installing on Mac OS X:
Rather than installing these packages from source, and instead of using MacPorts, it is relatively straightforward to use [Homebrew](http://brew.sh) to install ```DFU-util``` and ```openssl```. Once you have installed `brew` the basic command is ```brew install DFU-util openssl```.

Upgrading
---------------------------
To upgrade Particle-CLI, enter the following command:

```sh
$ npm update -g particle-cli
```


Running from source (advanced)
---------------------------
To grab the CLI source and play with it locally

```sh
git clone git@github.com:spark/particle-cli.git
cd particle-cli
npm install
node app.js help
```


Getting Started
===============

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

Apply the CC3000 patch [Core only]
===

The easiest way to apply the CC3000 patch is to flash the known "cc3000" firmware followed by the "tinker" firmware over USB.

1.) Make sure you have [DFU-util](http://dfu-util.sourceforge.net/) installed

2.) Connect your Core via usb, and place it into DFU mode by holding both buttons, and releasing reset, keep holding mode until your Core flashes yellow.

3.) Run ```particle flash --usb cc3000```

This will run a special firmware program that will update the firmware running inside the CC3000 WiFi module.
When it's done running, your Core will be blinking yellow in DFU-mode, you'll need to flash regular firmware like Tinker
to get connected and developing again.

4.) Run ```particle flash --usb tinker```

This will flash a new version of Tinker to your Core and return to a blinking blue "listening" state, where
you can:

5.) Run ```particle setup``` or ```particle setup wifi``` to provide your network credentials to get connected again.


Performing a "Deep update"
================

Any Core shipped before Summer 2014 would benefit from having this update applied at least once. It improves the Core's performance on very busy networks, and helps fix other minor issues. This update now ships with the CLI so you can apply it to Cores that are unable to get online otherwise.

1.) Make sure you have [DFU-util](http://dfu-util.sourceforge.net/) installed

2.) Connect your Core via usb, and place it into DFU mode by holding both buttons, and releasing RESET, keep holding MODE until your Core flashes yellow.

3.) Run ```particle flash --usb deep_update_2014_06```

4.) Your Core should reboot and try to connect to any previously saved wifi networks, and then update itself again.

Command Reference
================

### particle setup wifi

  Helpful shortcut for adding another wifi network to a device connected over USB.  Make sure your device is connected via a USB cable, and is slow blinking blue [listening mode](http://docs.particle.io/core/connect/)

```sh
$ particle setup wifi
```


### particle login

  Login and save an access token for interacting with your account on the Particle Cloud.

```sh
$ particle login
```


### particle logout

  Logout and optionally revoke the access token for your CLI session.

```sh
$ particle logout
```


### particle list

  Generates a list of what devices you own, and displays information about their status, including what variables and functions are available

```sh
$ particle list

Checking with the cloud...
Retrieving devices... (this might take a few seconds)
my_device_name (0123456789ABCDEFGHI) 0 variables, and 4 functions
  Functions:
    int digitalwrite(string)
    int digitalread(string)
    int analogwrite(string)
    int analogread(string)

```


### particle device add

  Adds a new device to your account

```sh
$ particle device add 0123456789ABCDEFGHI
Claiming device 0123456789ABCDEFGHI
Successfully claimed device 0123456789ABCDEFGHI
```


### particle device rename

  Assigns a new name to a device you've claimed

```sh
$ particle device rename 0123456789ABCDEFGHI "pirate frosting"
```



### particle device remove

  Removes a device from your account so someone else can claim it.

```sh
$ particle device remove 0123456789ABCDEFGHI
Are you sure?  Please Type yes to continue: yes
releasing device 0123456789ABCDEFGHI
server said  { ok: true }
Okay!
```


### particle flash

  Sends a firmware binary, a source file, or a directory of source files, or a known app to your device.

  Note!  When sending source code, the cloud compiles ```.ino``` and ```.cpp``` files differently.  For ```.ino``` files, the cloud will apply a pre-processor.  It will add missing function declarations, and it will inject an ```#include "
  application.h"``` line at the top of your files if it is missing.

  If you want to build a library that can be used for both Arduino and Particle, here's a useful code snippet:

```cpp
#if defined(ARDUINO) && ARDUINO >= 100
#include "Arduino.h"
#elif defined(SPARK)
#include "application.h"
#endif
```


#### Flashing a directory

  You can setup a directory of source files and libraries for your project, and the CLI will use those when compiling remotely.  You can also create ```particle.include``` and / or a ```particle.ignore``` file in that directory that will tell the CLI specifically which files to use or ignore.

```sh
$ particle flash deviceName my_project
```


#### Flashing one or more source files

  You can include any number of individual source files after the device Name, and the CLI will include them while flashing your app.


```sh
$ particle flash deviceName app.ino library1.cpp library1.h
```


#### Flashing a known app

  You can easily reset a device back to a previous existing app with a quick command. Three app names are reserved right now: "tinker", "voodoo", and "cc3000".  Tinker is the original firmware that ships with the device, and cc3000 will patch the wifi module on your Core. Voodoo is a build of [VoodooSpark](http://voodoospark.me/) to allow local wireless firmata control of a device.

```sh
$ particle flash deviceName tinker
$ particle flash deviceName cc3000
$ particle flash deviceName voodoo

```

  You can also update the factory reset version using the --factory flag, and over usb with --usb

```sh
$ particle flash --factory tinker
$ particle flash --usb tinker
```


#### Compiling remotely and Flashing locally

To work locally, but use the cloud compiler, simply use the compile command, and then the local flash command after.  Make sure you connect your device via USB and place it into [DFU mode](http://docs.particle.io/core/modes/#Core-modes-DFU-mode-device-firmware-upgrade).

```sh
$ particle compile device_type my_project_folder --saveTo firmware.bin
OR
$ particle compile device_type app.ino library1.cpp library1.h --saveTo firmware.bin
$ particle flash --usb firmware.bin
```


### particle compile

  Compiles one or more source file, or a directory of source files, and downloads a firmware binary. This is device specific and must be passed as an argument during compilation.

  The devices available are:

  - photon (alias is 'p')
  - core (alias is 'c')

  eg. `particle compile photon xxx` OR `particle compile p xxxx` both targets the photon

  Note!  The cloud compiles ```.ino``` and ```.cpp``` files differently.  For ```.ino``` files, the cloud will apply a pre-processor.  It will add missing function declarations, and it will inject an ```#include "
  application.h"``` line at the top of your files if it is missing.

  If you want to build a library that can be used for both Arduino and Particle, here's a useful code snippet:

```cpp
#if defined(ARDUINO) && ARDUINO >= 100
#include "Arduino.h"
#elif defined(SPARK)
#include "application.h"
#endif
```


#### compiling a directory

  You can setup a directory of source files and libraries for your project, and the CLI will use those when compiling remotely.  You can also create ```particle.include``` and / or a ```particle.ignore``` file in that directory that will tell the CLI specifically which files to use or ignore.  Those files are just plain text with one line per filename

```sh
$ particle compile device_type my_project_folder
```


#### example particle.include
```text
application.cpp
library1.h
library1.cpp
```


#### example particle.ignore
```text
.ds_store
logo.png
old_version.cpp
```


#### Compiling one or more source files

  You can include any number of individual source files after the device id, and the CLI will include them while compiling your app.


```sh
$ particle compile device_type app.ino library1.cpp library1.h
```
#### Compiling in a directory containing project files

 This will push all the files in a directory that the command line is currently 'cd' in for compilation.

 ```sh
 $ particle compile device_type .
 ```




### particle call

  Calls a function on one of your devices, use ```particle list``` to see which devices are online, and what functions are available.

```sh
$ particle call deviceName digitalwrite "D7,HIGH"
1
```


### particle get

  Retrieves a variable value from one of your devices, use ```particle list``` to see which devices are online, and what variables are available.

```sh
$ particle get deviceName temperature
72.1
```



### particle monitor

  Pulls the value of a variable at a set interval, and optionally display a timestamp

  * Minimum delay for now is 500 (there is a check anyway if you keyed anything less)
  * hitting ```CTRL + C``` in the console will exit the monitoring

```sh
$ particle monitor deviceName temperature 5000
$ particle monitor deviceName temperature 5000 --time
$ particle monitor all temperature 5000
$ particle monitor all temperature 5000 --time
$ particle monitor all temperature 5000 --time > my_temperatures.csv
```


### particle identify

  Retrieves your device id when the device is connected via USB and in listening mode (flashing blue).

```sh
$ particle identify
$ particle identify 1
$ particle identify COM3
$ particle identify /dev/cu.usbmodem12345

$ particle identify
0123456789ABCDEFGHI
```

### particle subscribe

  Subscribes to published events on the cloud, and pipes them to the console.  Special device name "mine" will subscribe to events from just your devices.


```sh
$ particle subscribe
$ particle subscribe mine
$ particle subscribe eventName
$ particle subscribe eventName mine
$ particle subscribe eventName deviceName
$ particle subscribe eventName 0123456789ABCDEFGHI
```




### particle serial list

  Shows currently connected devices acting as serial devices over USB

```sh
$ particle serial list
```


### particle serial monitor

  Starts listening to the specified serial device, and echoes to the terminal

```sh
$ particle serial monitor
$ particle serial monitor 1
$ particle serial monitor COM3
$ particle serial monitor /dev/cu.usbmodem12345
```


### particle keys doctor

Helps you update your keys, or recover your device when the keys on the server are out of sync with the keys on your device.  The ```particle keys``` tools requires both DFU-util, and openssl to be installed.

Connect your device in [DFU mode](http://docs.particle.io/#/connect/appendix-DFU-mode-device-firmware-upgrade), and run this command to replace the unique cryptographic keys on your device.  Automatically attempts to send the new public key to the cloud as well.

```sh
$ particle keys doctor your_device_id
```

There have been reports of the new public key not being sent to the cloud, in which case ```particle keys send``` will need to be run manually.

### particle keys new

Generates a new public / private keypair that can be used on a device.

```sh
$ particle keys new
running openssl genrsa -out device.pem 1024
running openssl rsa -in device.pem -pubout -out device.pub.pem
running openssl rsa -in device.pem -outform DER -out device.der
New Key Created!

$ particle keys new mykey
running openssl genrsa -out mykey.pem 1024
running openssl rsa -in mykey.pem -pubout -out mykey.pub.pem
running openssl rsa -in mykey.pem -outform DER -out mykey.der
New Key Created!
```

### particle keys load

Copies a ```.DER``` formatted private key onto your device's external flash.  Make sure your device is connected and in [DFU mode](http://docs.particle.io/core/modes/#Core-modes-DFU-mode-device-firmware-upgrade).  The `particle keys` tools requires both DFU-util, and openssl to be installed.  Make sure any key you load is sent to the cloud with `particle keys send device.pub.pem`

```sh
$ particle keys load device.der
...
Saved!
```

### particle keys save

Copies a ```.DER``` formatted private key from your device's external flash to your computer.  Make sure your device is connected and in [DFU mode](http://docs.particle.io/core/modes/#Core-modes-DFU-mode-device-firmware-upgrade).  The ```particle keys``` tools requires both DFU-util, and openssl to be installed.

```sh
$ particle keys save name_of_file
...
Saved!
```

### particle keys send

Sends a device's public key to the cloud for use in opening an encrypted session with your device.  Please make sure your device has the corresponding private key loaded using the ```particle keys load``` command.

```sh
$ particle keys send 0123456789ABCDEFGHI device.pub.pem
submitting public key succeeded!
```

### particle keys server

Switches the server public key stored on the device's external flash. This command is important when changing which server your device is connecting to, and the server public key helps protect your connection. Your device will stay in DFU mode after this command, so that you can load new firmware to connect to your server.


```sh
$ particle keys server my_server.der
Okay!  New keys in place, your device will not restart.
```


### particle keys server ip_address

When using the local cloud you can ask the CLI to encode the IP or dns address into your key to control where your device will connect.

```sh
$ particle keys server my_server.pub.pem 192.168.1.10
$ particle keys server my_server.der 192.168.1.10
```

### particle config

The config command lets you create groups of settings and quickly switch to a profile by calling `particle config profile-name`. This is especially useful for switching to your local server or between other environments.

Calling `particle config particle` will switch **Particle-Cli** back to the Particle Cloud API server.

```sh
$ particle config profile-name
$ particle config particle
$ particle config local apiUrl http://localhost:8080  //creates a new profile with name "local" and saves the IP-address parameter
$ particle config useSudoForDfu true
```

Calling `particle config identify` will output your current config settings.

```sh
$ particle config identify
Current profile: particle
Using API: https://api.particle.io
Access token: e671fadd500a8a3921bb78c8d0400d7ba450a847
```
