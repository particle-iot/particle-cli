Feature: function

  Scenario: help
    When I run particle "help function"
    Then the output should contain "call functions"
    And the output should contain "particle function list"
    And the exit status should be 0

  Scenario: halp call
    When I run particle "help call"
    Then the output should contain "Calls a function"
    And the output should contain "particle call"
    And the exit status should be 0
