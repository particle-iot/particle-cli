@wip
Feature: compile firmware for various platforms

  Background:
    Given the CLI is installed

  Scenario Outline: Can cloud compile firmware for all supported platforms
    Given I use fixture `cross_platform_app` 
    And I run the cli with `compile <platform> . --saveTo <platform>.bin`
    Then the file <platform>.bin should be valid <platform> firmware with platform ID equal to <platform_id>. 
    Examples:
      | platform | platform_id |
      | core | 0 |
      | photon | 6 |
      | electron | 10 |
      | p1 | 8 |
 
  @skip
  Scenario Outline: Can locally compile firmware for all supported platforms
    Given I use fixture `cross_platform_app`
    And I run the cli with `local compile <platform> . --saveTo local_<platform>.bin`
    Then the file local_<platform>.bin should be valid <platform> firmware with platform ID equal to <platform_id>. 
    Examples:
      | platform | platform_id |
      | core | 0 |
      | photon | 6 |
      | electron | 10 |
      | p1 | 8 |

# todo - how to avoid repeating the platform data?


  Scenario: Can clond compile firmware for a specific target
    Given I use fixture `firmware_0_5_0_app`
    And I run the cli with `compile photon . --saveTo photon.bin`
    Then the stderr should contian "unexpected". 
    And the exit status should not be 0

