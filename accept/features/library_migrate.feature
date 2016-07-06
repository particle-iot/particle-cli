Feature: library migrate

    Background: Example libraries are available
      # starts in accept/tmp/aruba
      When I copy the directory "../../../node_modules/particle-cli-library-manager/resources/libraries" to "libraries"
      Then a directory named "libraries" should exist
      And a directory named "libraries/library-v1" should exist

      Scenario: library-v1 in current directory is ready to migrate
        Given I cd to "libraries/library-v1"
        When I run particle "library migrate --test"
        Then the output should contain "can be migrated"

      Scenario: library-v1 is ready to migrate
        When I run particle "library migrate --test libraries/library-v1"
        Then the output should contain "can be migrated"

      Scenario: library-v2 test is already migrated
        When I run particle "library migrate --test libraries/library-v2"
        Then the output should contain "already in v2 format"

      Scenario: library-v2 migrate is already migrated
        When I run particle "library migrate libraries/library-v2"
        Then the output should contain "already in v2 format"

      Scenario: library-v1 is should migrate only once
        When I run particle "library migrate libraries/library-v1"
        Then the output should contain "migrated to v2 format"
        When I run particle "library migrate libraries/library-v1"
        Then the output should contain "already in v2 format"
        And the directories "libraries/library-v1" and "libraries/library-v2" should be equal
