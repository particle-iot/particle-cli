Feature: webhooks

  # https://github.com/spark/particle-cli/issues/282
  Scenario: the filename can end with uppercase JSON
    Given I use the fixture named "webhook"
    When I run particle "webhook create hook.JSON"
    Then the output should not contain "Please specify a url"
    And the output should contain "created"
    And the exit status should be 0

  Scenario: delete all
    When I run particle "webhook delete all" interactively
    And I respond to the prompt "delete ALL" with "y"
    And I close the stdin stream
    Then the output should contain "Found 1 hooks registered"
    And the exit status should be 0


