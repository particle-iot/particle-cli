Feature: Cloud compile

  Scenario: as a user, I can compile a simple project
    Given I use the fixture named "projects/tinker/simple"
    When I run particle "compile photon ."
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain "tinker.cpp"
    And the stdout should contain "Compile succeeded"


  Scenario: as a library developer I can compile a library example
    Given I use the fixture named "library/upload/valid/0.0.2"
    When I run particle "compile photon examples/blink-an-led"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain "library.properties"
    And the stdout should contain "examples/blink-an-led/blink-an-led.cpp"
    And the stdout should contain "src/test-library-publish.cpp"
    And the stdout should contain "src/test-library-publish.h"
    And the stdout should contain "Compile succeeded"


