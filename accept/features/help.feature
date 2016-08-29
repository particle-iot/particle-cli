Feature: help and default command

  Background:
    Given I have installed the CLI

    Scenario: Running the CLI with no arguments prints the help page
      Given I run particle ""
      Then stderr should not contain "Error"
      And stdout should not contain "Error"
      And the output should show the help page

    Scenario: Running the CLI with "help"
      Given I run particle "help"
      Then stderr should not contain "Error"
      And the output should show the help page

    Scenario: Running the CLI with "help"
      Given I run particle "help"
      Then stderr should not contain "Error"
      And the output should show the help page

    Scenario: Running the CLI with "--help"
      Given I run particle "--help"
      Then stderr should not contain "Error"
      And the output should show the new help page
