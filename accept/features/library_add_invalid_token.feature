Feature: add library without a valid access token

  # setup the test environment

  Scenario: setup the test access token
  Given I use the fixture named "accesstoken"
  And I copy the file "test_invalid.config.json" to "~/.particle/"
  And I copy the file "~/.particle/profile.json" to "~/.particle/profile.json.bak"
  Given a file named "~/.particle/profile.json" with:
  """
    {
      "name":"test_invalid"
    }
  """

  Scenario: a user cannot add a library with an invalid access token
  When I run particle "library add neopixel"
  Then the output should contain "invalid"
  And the output should contain "invalid_token"

  Scenario: tear down the test access token
  And I copy the file "~/.particle/profile.json.bak" to "~/.particle/profile.json"
