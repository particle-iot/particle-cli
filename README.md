spark-cli
=========

Spark Command Line Interface for the Cloud



npm install -g spark-cli




Getting Started
===============

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

    > spark cloud compile 0123456789ABCDEFGHI my_application.ino
    > spark cloud compile 0123456789ABCDEFGHI /projects/big_app/src

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

  Pulls the value of a variable at a set interval, and optionally display a timestamp

``` > spark serial list ```

``` > spark serial monitor ```

``` > spark serial wifi ```

``` > spark serial identify ```



###spark keys doctor

``` > spark keys doctor ```

  Runs a series of steps to generate a new public/private keypair, and send it to the server for your core.  Helpful
  for recovering from key issues.