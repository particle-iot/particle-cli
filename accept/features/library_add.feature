Feature: library add
  Scenario: adding a library to an existing project by specifying the version
    Given I use the fixture named "projects/simple"
    When I run particle "library add neopixel@0.0.10"
    Then the file "project.properties" should contain "dependencies.neopixel=0.0.10"
    And the exit status should be 0

  Scenario: adding a library to an existing project by specifying the name only
    Given I use the fixture named "projects/simple"
    When I run particle "library add neopixel"
    Then the file "project.properties" should match /dependencies.neopixel=((\d+)\.)?((\d+)\.)?(\d+)/
    And the exit status should be 0

    # todo - should this really just go ahead and add project.properties?
  Scenario: adding a library to a legacy project
    Given I use the fixture named "projects/legacy"
    When I run particle "library add neopixel@0.0.10"
    Then the file "project.properties" should exist
    And the exit status should be 0

  Scenario: adding a library to a non-writable project
    Given an empty file named "project.properties" with mode "0444"
    When I run particle "library add neopixel"
    Then the output should contain "EACCES"
    And the exit status should not be 0

  Scenario: a user may attempt to add a non-existent library
    Given I use the fixture named "projects/simple"
    When I run particle "library add doesnotexist_lib"
    Then the output should contain "Library doesnotexist_lib not found"
    And the exit status should not be 0

  Scenario: a user may get help when running particle library add with no additinoal parameters
    When I run particle "library add"
    Then the output should contain "Usage: library add [options] <name>"
    # todo - also show command description "Add a library to a project"??