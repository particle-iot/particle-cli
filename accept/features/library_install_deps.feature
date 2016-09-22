Feature: installation of libraries with dependencies

  Background: A skeleton extended project
    Given an empty file named "project.properties"
    And an empty file named "src/hello.cpp"

  Scenario: ensure libraries are published
    Given The particle library "test-library-transitive-1" is removed

    Given I copy the directory "../../../node_modules/particle-cli-library-manager/resources/libraries/publish/transitive" to "."
    And a directory named "transitive/trans1" should exist
    And I cd to "transitive/trans1"
    And I run particle "library publish"
    Then the output should contain "successfully published"

  Scenario: As a user, I can install a library with dependencies
    When I run particle "library install --vendored test-library-transitive-1"
    Then the file "project.properties" should not contain "dependencies"
    And the file named "lib/test-library-transitive-1/src/test-library-transitive-1.cpp" should exist
    And the file named "lib/neopixel/src/neopixel.cpp" should exist

  Scenario: ensure libraries are removed
    Given The particle library "test-library-transitive-1" is removed
