Feature: the user can login

  Scenario: the user can login with valid credentials
    When I run particle "login" interactively
    And I respond to the prompt "email address" with environment variable "ACCESS_EMAIL"
    And I respond to the prompt "password" with environment variable "ACCESS_PWD"
    And I close the stdin stream
    Then the output should contain "Successfully completed login!"
    And the exit status should be 0

  Scenario: the user cannot login with invalid credentials
    When I run particle "login" interactively
    And I respond to the prompt "email address" with environment variable "ACCESS_EMAIL"
    And I respond to the prompt "password" with "blahblahblah"
    And I close the stdin stream
    Then the output should contain "credentials are invalid"
    And the exit status should be 130
