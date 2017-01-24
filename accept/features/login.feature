Feature: the user can login

  Scenario: the user can login with valid credentials
    When I run particle "login" interactively
    And I respond to the prompt "email address" with "mat+test@particle.io"
    And I respond to the prompt "password" with "mdmamdma"
    And I close the stdin stream
    Then the output should contain "Successfully completed login!"
    And the exit status should be 0

  Scenario: the user cannot login with invalid credentials
    When I run particle "login" interactively
    And I respond to the prompt "email address" with "mat+test@particle.io"
    And I respond to the prompt "password" with "mdmamdma2"
    And I close the stdin stream
    Then the output should contain "credentials are invalid"
    And the exit status should be 0
