Feature: searching for libraries

  Scenario: the user must supply a string to match
    When I run particle "library search"
    And the output should match exactly once /Parameter 'name' is required/

  Scenario: the user can search for libraries matching a string and see the matching libraries
    When I run particle "library search neo"
    Then the output should contain "neopixel"
    And the stdout should match exactly once /Found [0-9]+ libraries matching neo/
    And the output should contain "An Implementation of Adafruit's NeoPixel Library"
    And the output should match /(neo.* [0-9]\.[0-9]\.[0-9] [0-9]+)+/

  Scenario: the user can search for libraries a string and see there are no matching libraries
    When I run particle "library search thiswillnotexist"
    Then the output should not contain "neopixel"
    And the stdout should match exactly once /Found 0 libraries matching thiswillnotexist/

  Scenario: a match for one library uses the correct grammar
    When I run particle "library search flashee-eeprom"
    Then the output should contain "Found 1 library matching flashee-eeprom"

  Scenario: the library description can be retrieved by passing the verbose flag
    When I run particle "library search neo -v"
    Then the output should contain "neopixel"
    And the stdout should match exactly once /Found [0-9]+ libraries matching neo/
    And the output should contain "An Implementation of Adafruit's NeoPixel Library"
    And the output should match /(neo.* [0-9]\.[0-9]\.[0-9] [0-9]+)+/
