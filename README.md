Particle CLI
==========

The Particle CLI is a powerful tool for interacting with your devices and the Particle Cloud.  The CLI uses [node.js](http://nodejs.org/) and can run on Windows, Mac OS X, and Linux fairly easily.  It's also [open source](https://github.com/spark/particle-cli) so you can edit and change it, and even send in your changes as [pull requests](https://help.github.com/articles/using-pull-requests) if you want to share!

Known Issues
========
* Currently the CLI is unable to perform cloud compiling for Photons. This will be fixed shortly.
* The Wireless Photon Setup Wizard is currently only available for OS X. Users of other operating systems will need to manually connect their computer to the Photon's Wi-Fi.
* The Wireless Photon Setup Wizard will occasionally output an error regarding 'unhandled rejection'. This is annoying but harmless and will be fixed in future releases.
* Photon setup does not currently ask you to name your Photon. You can still do so from the IDE: https://build.particle.io/build
* Photon setup does not currently support non-broadcast SSID Wi-Fi networks. Please feel free to complain to Emily if this is affecting you.

Installing
=======

#### If you've already installed `spark-cli`, please uninstall it before continuing.
#### Simply type: `npm uninstall -g spark-cli` into the command line.

  First, make sure you have [node.js](http://nodejs.org/) installed!

  Next, open a command prompt or terminal, and install by typing:

```sh
$ npm install -g particle-cli
$ particle cloud login
```

  *Note!*  If you have problems running this, make sure you using Terminal / the Command Prompt as an Administator, or try using `sudo`

```sh
$ sudo npm install -g particle-cli
```


Install (advanced)
---------------------------

To use the local flash and key features you'll need to install [dfu-util](http://dfu-util.sourceforge.net/) (note the normal main page http://dfu-util.gnumonks.org/ is still down), and [openssl](http://www.openssl.org/).  They are freely available and open-source, and there are installers and binaries for most major platforms as well.

Here are some great tutorials on the community for full installs:

[Installing on Ubuntu](https://community.particle.io/t/how-to-install-spark-cli-on-ubuntu-12-04/3474)

[Installing on Windows](https://community.particle.io/t/tutorial-spark-cli-on-windows-06-may-2014/3112)

#### Installing on Mac OS X:
Rather than installing these packages from source, and instead of using MacPorts, it is relatively straightforward to use [Homebrew](http://brew.sh) to install `dfu-util`, `openssl`, and `libusb` (required for dfu-util). Once you have installed `brew` the basic command for each is `brew install dfu-util` . For the final step of `openssl` you will need to do `sudo brew install openssl` and enter your admin password.

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

Apply the CC3000 patch
===

The easiest way to apply the CC3000 patch is to flash the known "cc3000" firmware followed by the "tinker" firmware over USB.
Note, this process will soon be replaced by "deep update" that will streamline and simplify this process further. (see next section)

1.) Make sure you have [dfu-util](http://dfu-util.gnumonks.org/) installed

2.) Connect your core via usb, and place it into dfu mode by holding both buttons, and releasing reset, keep holding mode until your core flashes yellow.

3.) Run `particle flash --usb cc3000`

This will run a special firmware program that will update the firmware running inside the CC3000 WiFi module.
When it's done running, your core will be blinking yellow in dfu-mode, you'll need to flash regular firmware like Tinker
to get connected and developing again.

4.) Run `particle flash --usb tinker`

This will flash a new version of Tinker to your core and return to a blinking blue "listening" state, where
you can:

5.) Run `particle setup` or `particle setup wifi` to provide your network credentials to get connected again.


Performing a "Deep update"
================

Any core shipped before Summer 2014 would benefit from having this update applied at least once.  It improves the core's performance on very busy networks, and helps fix other minor issues.  This update now ships with the cli so you can apply it to cores that are unable to get online otherwise.

1.) Make sure you have [dfu-util](http://dfu-util.gnumonks.org/) installed

2.) Connect your core via usb, and place it into dfu mode by holding both buttons, and releasing reset, keep holding mode until your core flashes yellow.

3.) Run ```particle flash --usb deep_update_2014_06```

4.) Your core should reboot and try to connect to any previously saved wifi networks, and then update itself again.

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


### particle core add

  Adds a new core to your account

```sh
$ particle cloud claim 0123456789ABCDEFGHI
Claiming device 0123456789ABCDEFGHI
Successfully claimed device 0123456789ABCDEFGHI
```


### particle core rename

  Assigns a new name to a core you've claimed

```sh
$ particle core rename 0123456789ABCDEFGHI "pirate frosting"
```



### particle core remove

  Removes a core from your account so someone else can claim it.

```sh
$ particle core remove 0123456789ABCDEFGHI
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
$ particle flash 0123456789ABCDEFGHI my_project
```


#### Flashing one or more source files

  You can include any number of individual source files after the device id, and the CLI will include them while flashing your app.


```sh
$ particle flash 0123456789ABCDEFGHI app.ino library1.cpp library1.h
```


#### Flashing a known app

  You can easily reset a device back to a previous existing app with a quick command. Three app names are reserved right now: "tinker", "voodoo", and "cc3000".  Tinker is the original firmware that ships with the device, and cc3000 will patch the wifi module on your Core. Voodoo is a build of [VoodooSpark](http://voodoospark.me/) to allow local wireless firmata control of a device.

```sh
$ particle flash 0123456789ABCDEFGHI tinker
$ particle flash 0123456789ABCDEFGHI cc3000
$ particle flash 0123456789ABCDEFGHI voodoo

```

  You can also update the factory reset version using the --factory flag, and over usb with --usb

```sh
$ particle flash --factory tinker
$ particle flash --usb tinker
```


#### Compiling remotely and Flashing locally

To work locally, but use the cloud compiler, simply use the compile command, and then the local flash command after.  Make sure you connect your device via USB and place it into [dfu mode](http://docs.particle.io/core/modes/#core-modes-dfu-mode-device-firmware-upgrade).

```sh
$ particle compile my_project_folder --saveTo firmware.bin
OR
$ particle compile app.ino library1.cpp library1.h --saveTo firmware.bin
$ particle flash --usb firmware.bin
```


### particle compile

  Compiles one or more source file, or a directory of source files, and downloads a firmware binary.

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
$ particle compile my_project_folder
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
$ particle compile app.ino library1.cpp library1.h
```
#### Compiling in a directory containing project files

 This will push all the files in a directory that the command line is currently 'cd' in for compilation.

 ```sh
 $ particle compile .
 ```




### particle call

  Calls a function on one of your devices, use ```particle list``` to see which devices are online, and what functions are available.

```sh
$ particle call 0123456789ABCDEFGHI digitalwrite "D7,HIGH"
1
```


### particle get

  Retrieves a variable value from one of your devices, use ```particle list``` to see which devices are online, and what variables are available.

```sh
$ particle get 0123456789ABCDEFGHI temperature
72.1
```



### particle monitor

  Pulls the value of a variable at a set interval, and optionally display a timestamp

  * Minimum delay for now is 500 (there is a check anyway if you keyed anything less)
  * hitting ```CTRL + C``` in the console will exit the monitoring

```sh
$ particle monitor 0123456789ABCDEFGHI temperature 5000
$ particle monitor 0123456789ABCDEFGHI temperature 5000 --time
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

  Subscribes to published events on the cloud, and pipes them to the console.  Special device name "mine" will subscribe to events from just your cores.


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

Helps you update your keys, or recover your device when the keys on the server are out of sync with the keys on your device.  The ```particle keys``` tools requires both dfu-util, and openssl to be installed.

Connect your device in [dfu mode](http://docs.particle.io/#/connect/appendix-dfu-mode-device-firmware-upgrade), and run this command to replace the unique cryptographic keys on your device.  Automatically attempts to send the new public key to the cloud as well.

```sh
$ particle keys doctor 0123456789ABCDEFGHI
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

Copies a ```.DER``` formatted private key onto your device's external flash.  Make sure your device is connected and in [dfu mode](http://docs.particle.io/core/modes/#core-modes-dfu-mode-device-firmware-upgrade).  The ```particle keys``` tools requires both dfu-util, and openssl to be installed.  Make sure any key you load is sent to the cloud with ```particle keys send device.pub.pem```

```sh
$ particle keys load device.der
...
Saved!
```

### particle keys save

Copies a ```.DER``` formatted private key from your device's external flash to your computer.  Make sure your device is connected and in [dfu mode](http://docs.particle.io/core/modes/#core-modes-dfu-mode-device-firmware-upgrade).  The ```particle keys``` tools requires both dfu-util, and openssl to be installed.

```sh
$ particle keys save device.der
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

Switches the server public key stored on the device's external flash.  This command is important when changing which server your device is connecting to, and the server public key helps protect your connection.   Your device will stay in DFU mode after this command, so that you can load new firmware to connect to your server.


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
