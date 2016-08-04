Feature: library add
  Scenario: adding a library to an existing project
    Given I use the fixture named "projects/simple"
    When I run particle "library add neopixel@0.0.10"
    Then the file "project.properties" should contain "dependencies.neopixel=0.0.10"

  Scenario: a user may attempt to add a non-existent library
    Given I use the fixture named "projects/simple"
    When I run particle "library add doesnotexist_lib"
    Then the output should contain "Library doesnotexist_lib not found"

