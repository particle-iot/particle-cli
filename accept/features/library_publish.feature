Feature: library publish

  Scenario: publishing in a directory that doesn't contain a library
    Given I use the fixture named "library/publish/invalid/nolibrary"
    When I run particle "library publish"
    Then the output should contain "Library is not valid"
    And the exit status should not be 0

  Scenario: publishing a v1 library
    Given I copy the directory "../../../node_modules/particle-cli-library-manager/resources/libraries" to "libraries"
    And a directory named "libraries/library-v1" should exist
    When I cd to "libraries/library-v1"
    And I run particle "library publish"
    Then the output should contain "Library is not valid"
    And the exit status should not be 0


  Scenario: publishing in a directory that contains a library with an invalid name
    Given I use the fixture named "library/publish/invalid/name"
    When I run particle "library publish"
    Then the output should contain "Library is not valid"
# todo add specific validation error
#    And the output should contain "name"
    And the exit status should not be 0

  Scenario: publishing in a directory that contains a valid library works first time
    Given The particle library "test-library-publish" is removed
    And I use the fixture named "library/publish/valid/0.0.1"
    When I run particle "library publish"
    Then the output should contain "Library test-library-publish was successfully published"
    And the exit status should be 0

  Scenario: republishing the same version of a library fails
    And I use the fixture named "library/publish/valid/0.0.1"
    When I run particle "library publish"
    Then the output should contain "This version already exists"
    And the exit status should not be 0

  Scenario: publishing a newer version of a library
    And I use the fixture named "library/publish/valid/0.0.2"
    When I run particle "library publish"
    Then the output should contain "Library test-library-publish was successfully published"
    And the exit status should be 0

  Scenario: cleanup
    Given The particle library "test-library-publish" is removed
    When I run particle "library search test-library-publish"
    And the stdout should match exactly once /Found 0 libraries matching/
