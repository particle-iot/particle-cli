Feature: library

  Scenario: when the user types in an unrecognized command, an error is produced.
    When I run particle "library asdfhj"
    Then the output should contain "No such command"
    And the output should contain "library asdfhj"

