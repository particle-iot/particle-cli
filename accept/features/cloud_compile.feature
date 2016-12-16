Feature: Cloud compile

  Scenario: as a user, I can compile a legacy flat project
    Given I use the fixture named "projects/legacy/flat"
    When I run particle "compile photon"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain " app.ino"
    And the stdout should contain " helper.h"
    And the stdout should contain " helper.cpp"
    And the stdout should contain "Compile succeeded"

  Scenario: as a user, I can compile a legacy nested project
    Given I use the fixture named "projects/legacy/nested"
    When I run particle "compile photon"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain " app.ino"
    And the stdout should contain " helper/helper.h"
    And the stdout should contain " helper/helper.cpp"
    And the stdout should contain "Compile succeeded"

  Scenario: as a user, I can compile a legacy project with particle.include
    Given I use the fixture named "projects/legacy/particle.include"
    When I run particle "compile photon main"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain " main/app.ino"
    And the stdout should contain " helper/helper.h"
    And the stdout should contain " helper/helper.cpp"
    And the stdout should contain "Compile succeeded"

  Scenario: as a user, I can compile a legacy project with many files
    Given I use the fixture named "projects/legacy/flat"
    When I run particle "compile photon *"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain " app.ino"
    And the stdout should contain " helper.h"
    And the stdout should contain " helper.cpp"
    And the stdout should contain "Compile succeeded"

  Scenario: as a user, I can compile a legacy project by directory name
    Given I use the fixture named "projects/legacy"
    When I run particle "compile photon flat"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain " flat/app.ino"
    And the stdout should contain " flat/helper.h"
    And the stdout should contain " flat/helper.cpp"
    And the stdout should contain "Compile succeeded"

  Scenario: as a user, I can compile a simple project
    Given I use the fixture named "projects/simple"
    When I run particle "compile photon"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain " app.ino"
    And the stdout should contain "Compile succeeded"

  Scenario: as a user, I can compile an extended project
    Given I use the fixture named "projects/extended"
    When I run particle "compile photon"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain " src/app.ino"
    And the stdout should contain " src/helper/helper.h"
    And the stdout should contain " src/helper/helper.cpp"
    And the stdout should contain "Compile succeeded"

  Scenario: as a library developer I can compile a library example
    Given I use the fixture named "library/upload/valid/0.0.2"
    When I run particle "compile photon examples/blink-an-led"
    Then the stdout should contain "Compiling code for photon"
    And the stdout should contain " library.properties"
    And the stdout should contain " examples/blink-an-led/blink-an-led.cpp"
    And the stdout should contain " src/test-library-publish.cpp"
    And the stdout should contain " src/test-library-publish.h"
    And the stdout should contain "Compile succeeded"


