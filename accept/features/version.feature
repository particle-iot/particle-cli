Feature: Version

  Background: The CLI outputs the current version

    Scenario: I can fetch the version from the CLI
      Given I run particle "--version"
      Then the stderr should not contain anything
      And the output should match /\d+\.\d+\.\d+/


