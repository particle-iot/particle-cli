@wip
Feature: Flash firmware

   Scenario: Flash blinky via USB
      Given a Photon device `$deviceID` connected via USB
      And I invoke the cli with `flash --usb blinky_photon.bin`
      Then the device firmware matches `blinky_photon.bin`


   Scenario: Flash via USB
      Given a Photon device `$deviceID` named `clitest` connected via USB
      And I invoke the cli with `flash --usb tinker`
      Then device `clitest` should have tinker cloud functions.


   Scenario: Flash firmware to to a remote device
      Given a Photon device named `clitest` connected online
      And I invoke the cli with `flash clitest blinky_photon.bin`
      Then the device `clitest` has cloud variable `blinky`.




