Feature: library upload

  Scenario: contributing in a directory that doesn't contain a library
    Given I use the fixture named "library/upload/invalid/nolibrary"
    When I run particle "library upload"
    Then the output should contain "Library is not valid"
    And the exit status should not be 0

  Scenario: contributing a v1 library
    Given I copy the directory "../../../node_modules/particle-library-manager/resources/libraries" to "libraries"
    And a directory named "libraries/library-v1" should exist
    When I cd to "libraries/library-v1"
    And I run particle "library upload"
    Then the output should contain "Library is not valid"
    And the exit status should not be 0

  Scenario: contributing in a directory that contains a library with an invalid name
    Given I use the fixture named "library/upload/invalid/name"
    When I run particle "library upload"
    Then the output should contain "Library is not valid"
    And the output should contain "name"
    And the exit status should not be 0

  Scenario: contributing in a directory that contains a valid library works first time
    Given The particle library "test-library-publish" is removed
    And I use the fixture named "library/upload/valid/0.0.1"
    When I run particle "library upload"
    Then the output should contain "Library test-library-publish was successfully uploaded"
    And the exit status should be 0

  Scenario: the uploaded library is initially private
    When I run particle "library search test-library-publish"
    Then the output should contain "Found 1 library matching test-library-publish"
    And the output should contain "test-library-publish 0.0.1 [private] 0 A simple library that illustrates"

  Scenario: contributing the same version of a private library is ok
    And I use the fixture named "library/upload/valid/0.0.1"
    When I run particle "library upload"
    Then the output should contain "Library test-library-publish was successfully uploaded"
    And the exit status should be 0

  Scenario: contributing a newer version of a library
    And I use the fixture named "library/upload/valid/0.0.2"
    When I run particle "library upload"
    Then the output should contain "Library test-library-publish was successfully uploaded"
    And the exit status should be 0

  Scenario: publishing the library
    When I run particle "library publish test-library-publish"
    Then the output should contain "Library test-library-publish was successfully published"
    And the exit status should be 0

  Scenario: the published library is not private
    When I run particle "library search test-library-publish"
    Then the output should contain "Found 1 library matching test-library-publish"
    And the output should contain "test-library-publish"
    And the output should not contain "[private]"

  Scenario: cleanup
    Given The particle library "test-library-publish" is removed
    When I run particle "library search test-library-publish"
    And the stdout should match exactly once /Found 0 libraries matching/
