Feature: installation of libraries to a central directory

  Scenario: I can install a library
    When I run particle "library install neopixel@0.0.10 --dest=."
    Then a directory named "neopixel@0.0.10" should exist
    And a file named "neopixel@0.0.10/library.properties" should exist
    And a file named "neopixel@0.0.10/src/neopixel.cpp" should exist
    And the output should contain "installed"

