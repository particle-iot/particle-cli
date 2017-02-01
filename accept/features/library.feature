Feature: library

  Scenario: when the user types in an unrecognized command, an error is produced.
    When I run particle "library asdfhj"
    Then the output should contain "No such command"
    And the output should contain "library asdfhj"

  Scenario: when the user doesn't specify a subcommand the container command help is shown
    When I run particle "library"
    Then the output should contain "Usage: library <command>"
    And the output should contain "Creates a new library"

  Scenario: the library help is listed
    When I run particle "help library"
    Then the output should contain "The following commands are available:"
    

