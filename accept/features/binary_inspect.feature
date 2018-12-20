Feature: binary inspect

  Background:
    Given I use the fixture named "tinker"

  @smoketest
  Scenario: Smoke test Core tinker app binary
    Given I run particle "binary inspect core_tinker.bin"
    Then the stderr should not contain anything
    Then the stdout should contain "monolithic"

  Scenario: Detailed test Core tinker app binary
    Given I run particle "binary inspect core_tinker.bin"
    Then the stdout should contain:
    """
    core_tinker.bin
     CRC is ok (aded513e)
     Compiled for core
     This is a monolithic firmware number 0 at version 0
    """

  @smoketest
  Scenario: Smoke test Photon tinker app binary
    Given I run particle "binary inspect tinker-0.4.5-photon.bin"
    Then the stdout should not contain "monolithic"

  Scenario: Detailed test Photon tinker app binary
    Given I run particle "binary inspect tinker-0.4.5-photon.bin"
    Then the stdout should contain:
    """
    tinker-0.4.5-photon.bin
     CRC is ok (4a738441)
     Compiled for photon
     This is an application module number 1 at version 3
     It depends on a system module number 2 at version 6
    """

  Scenario: Detailed test P1 tinker app binary
    Given I run particle "binary inspect tinker-0.4.5-p1.bin"
    Then the stdout should contain:
    """
    tinker-0.4.5-p1.bin
     CRC is ok (70e7c48c)
     Compiled for p1
     This is an application module number 1 at version 3
     It depends on a system module number 2 at version 6
     """

  Scenario: Detailed test Electron tinker app binary
    Given I run particle binary inspect electron_tinker.bin
    Then the stdout should contain:
    """
    electron_tinker.bin
     CRC is ok (b3934494)
     Compiled for electron
     This is an application module number 1 at version 3
     It depends on a system module number 2 at version 10
     """
