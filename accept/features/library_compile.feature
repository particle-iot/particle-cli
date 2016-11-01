
Feature: compile supports libraries v2

  Scenario: basic extended project using a library
    Given I use the fixture named "projects/compile/extended"
    When I run particle "compile photon"
    Then the exit status should be 0
    And the output should contain "Memory use"

  Scenario: basic legacy project without a library
    Given I use the fixture named "projects/compile/legacy"
    When I run particle "compile photon"
    Then the exit status should be 0
    And the output should contain "Memory use"

  Scenario: basic failing project
    Given I use the fixture named "projects/compile/fail"
    When I run particle "compile photon"
    Then the exit status should be 1
    And the output should contain "Compile failed"

  Scenario: copied library project
    Given I use the fixture named "projects/compile/copied"
    And I run particle "library copy neopixel"
    When I run particle "compile photon"
    Then the exit status should be 0
    And the output should contain "Memory use"
