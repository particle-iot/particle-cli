Feature: library install


  Scenario: help does mention vendor
    When I run particle "library install --help"
    Then the output should contain "--vendored"

  Scenario: help does not mention adapter
    When I run particle "library install --help"
    Then the output should not contain "--adapter"

  Scenario: as a user I can install neopixel as a vendored library in an extended project
    Given an empty file named "project.properties"
    And an empty file named "src/hello.cpp"
    When I run particle "library install --vendored neopixel"
    Then the directory "lib" should exist
    And the file "lib/neopixel/library.properties" should exist
    And the file "lib/neopixel/src/neopixel.cpp" should exist
    And the file "lib/neopixel/src/neopixel.h" should exist
    And the file "lib/neopixel/src/neopixel/neopixel.h" should exist
    And the exit status should be 0
    
  Scenario: as a user I can attempt to install a non-existent library as a vendored library in an extended project
    Given an empty file named "project.properties"
    And an empty file named "src/hello.cpp"
    When I run particle "library install --vendored doesnotexist"
    Then the directory "lib" should not exist
    And the exit status should not be 0

  # todo we need more than one library on prod to test installing multiple libx
  Scenario: as a superuser I can install all the libraries of a project as vendored libraries
    Given a file named "project.properties" with:
    """
      dependencies.neopixel=0.0.10
    """
    And an empty file named "src/hello.cpp"
    When I run particle "library install --vendored -y"
    Then the directory "lib" should exist
    And the file "lib/neopixel/library.properties" should exist
    And the file "lib/neopixel/src/neopixel.cpp" should exist
    And the file "lib/neopixel/src/neopixel.h" should exist
    And the exit status should be 0


