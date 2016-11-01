
Feature: compile supports libraries v2

  Scenario: basic extended project using a library
    Given I use the fixture named "projects/compile/extended"
    And I run particle "compile photon"
    Then the exit status should be 0
    And the output should contain "Memory use"

  Scenario: basic legacy project without a library
    Given I use the fixture named "projects/compile/legacy"
    And I run particle "compile photon"
    Then the exit status should be 0
    And the output should contain "Memory use"

  Scenario: basic failing project
    Given I use the fixture named "projects/compile/fail"
    And I run particle "compile photon"
    Then the exit status should be 1
    And the output should contain "Compile failed"
