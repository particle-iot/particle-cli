Feature: library install


  Scenario: as a user I can install neopixel as a vendored library in an extended project
    Given an empty file named "project.properties"
    And an empty file named "src/hello.cpp"
    When I run particle "library install --vendored neopixel"
    And the directory "lib" should exist
    And the file "lib/neopixel/library.properties" should exist
    And the file "lib/neopixel/src/neopixel.cpp" should exist
    And the file "lib/neopixel/src/neopixel.h" should exist
