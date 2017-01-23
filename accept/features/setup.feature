Feature: setup

  Scenario: setup the test access token
    Given I copy the file "~/.particle/profile.json" to "~/.particle/profile.json.bak"
    Given a file named "~/.particle/profile.json" with:
    """
    {
      "name":"test_setup"
    }
    """
    Given a file named "~/.particle/test_setup.config.json" with:
    """
    {
    }
    """

  Scenario: as a user, running setup walks me through logging in and adding a device
    When I run particle "setup" interactively
    And I respond to the prompt "What would you like" with code "<Down>"
    And I respond to the prompt "email address" with "mat+test@particle.io"
    And I respond to the prompt "password" with "mdmamdma"
    And I respond to the prompt "scan for nearby Photons" with "n"
    And I close the stdin stream
    Then the output should contain "Goodbye!"
    And the exit status should be 0

  Scenario: tear down the test access token
    And I copy the file "~/.particle/profile.json.bak" to "~/.particle/profile.json"
