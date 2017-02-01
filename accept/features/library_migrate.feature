Feature: library migrate

  Background: Example libraries are available
    # starts in accept/tmp/aruba
    #When I copy the library resource "*" to "libraries"
    When I copy the directory "../../../node_modules/particle-library-manager/resources/libraries" to "libraries"
    Then a directory named "libraries" should exist
    And a directory named "libraries/library-v1" should exist

  Scenario: library-v1 in current directory is ready to migrate
    Given I cd to "libraries/library-v1"
    When I run particle "library migrate --test"
    Then the output should contain "can be migrated"
    And the exit status should be 0

  Scenario: library-v1 is ready to migrate
    When I run particle "library migrate --test libraries/library-v1"
    Then the output should contain "can be migrated"
    And the exit status should be 0

  Scenario: library-v2 test is already migrated
    When I run particle "library migrate --test libraries/library-v2"
    Then the output should contain "already in v2 format"
    And the exit status should be 0

  Scenario: library-v2 migrate is already migrated
    When I run particle "library migrate libraries/library-v2"
    Then the output should contain "already in v2 format"
    And the exit status should be 0

  Scenario: library-v1 should migrate with adapter headers
    When I run particle "library migrate --adapter libraries/library-v1"
    Then the output should contain "migrated to v2 format"
    And the file "libraries/library-v1/src/uber-library-example/uber-library-example.h" should exist
    And the file "libraries/library-v1/src/uber-library-example/uber-library-example.h" should contain "../uber-library-example.h"
    And the directories "libraries/library-v1" and "libraries/library-v2-adapters" should be equal
    And the exit status should be 0

  Scenario: library-v1 is should migrate with adapter headers by default
    When I run particle "library migrate libraries/library-v1"
    Then the output should contain "migrated to v2 format"
    And the file "libraries/library-v1/src/uber-library-example/uber-library-example.h" should exist
    And the directories "libraries/library-v1" and "libraries/library-v2-adapters" should be equal
    And the exit status should be 0

  Scenario: library-v1 is should migrate without adapter headers when the --no-adapters flag is present
    When I run particle "library migrate --no-adapter libraries/library-v1"
    Then the output should contain "migrated to v2 format"
    And the directories "libraries/library-v1" and "libraries/library-v2" should be equal
    And the exit status should be 0

  Scenario: library-v1 is should migrate only once
    When I run particle "library migrate libraries/library-v1"
    Then the output should contain "migrated to v2 format"
    And the exit status should be 0
    When I run particle "library migrate libraries/library-v1"
    Then the output should contain "already in v2 format"
    And the exit status should be 0
