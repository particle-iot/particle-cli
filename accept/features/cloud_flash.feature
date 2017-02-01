@wip
Feature: cloud flash

  Scenario: as a user, I can flash source to a device
    Given I use the fixture named "projects/legacy/flat"
    When I wait until the device "cli_test_photon" is online
    When I run particle "flash cli_test_photon"
    Then the stdout should contain "attempting to flash firmware"
    And the stdout should contain " app.ino"
    And the stdout should contain " helper.h"
    And the stdout should contain " helper.cpp"
    And the stdout should contain "Flash device OK"
    # FIXME: the CLI doesn't wait for the flash to finish so we delay to let the flash complete
    And I run `sleep 1`

  Scenario: as a user, I can flash a binary to a device
    Given I use the fixture named "tinker"
    When I wait until the device "cli_test_photon" is online
    When I run particle "flash cli_test_photon photon_tinker.bin"
    Then the stdout should contain "attempting to flash firmware"
    And the stdout should contain " photon_tinker.bin"
    And the stdout should contain "Flash device OK"
    # FIXME: the CLI doesn't wait for the flash to finish so we delay to let the flash complete
    And I run `sleep 1`

  Scenario: as a user, I can flash a known app to a device
    When I wait until the device "cli_test_photon" is online
    When I run particle "flash cli_test_photon tinker"
    Then the stdout should contain "attempting to flash firmware"
    And the stdout should contain "Flash device OK"
    And I run `sleep 1`
