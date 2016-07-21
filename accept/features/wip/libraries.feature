@wip
Feature: libraries

  Scenario: Can add vendored library
     Given I use a fixture named "neopixel_app"
     And I successfully run the cli with ` library add neopixel --vendored`
     Then the following files should exist:
        | lib/neopixel/neopixel.h |
        | lib/neopixel/neopixel.cpp  |
        | lib/neopixel/libraries.properties |


  Scenario: Can compile vendored library
     Given I use a fixture named "neopixel_app"
     And I successfully run the cli with `library add neopixel --vendored`
     And I successfully run the cli with `local compile photon --saveTo neopixel.bin`
     Then the file `neopixel.bin` should be valid photon firmware.
