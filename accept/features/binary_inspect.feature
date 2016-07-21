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
    Given I run particle "binary inspect photon_tinker.bin"
    Then the stdout should not contain "monolithic"

  Scenario: Detailed test Photon tinker app binary
    Given I run particle "binary inspect photon_tinker.bin"
    Then the stdout should contain:
    """
    photon_tinker.bin
     CRC is ok (ba4f59ab)
     Compiled for photon
     This is an application module number 1 at version 2
     It depends on a system module number 2 at version 1
    """

  Scenario: Detailed test P1 tinker app binary
    Given I run particle "binary inspect p1_tinker.bin"
    Then the stdout should contain:
    """
    p1_tinker.bin
     CRC is ok (61972e4d)
     Compiled for p1
     This is an application module number 1 at version 2
     It depends on a system module number 2 at version 3
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
