Feature: library init

  Scenario: as a user, I can scaffold a new library without prompting by providing all the
    details on the command line.
    When I run particle "library init --name=uberlib2 --version=1.2.3 --author=J.R.Hartley"
    Then the output should contain:
    """
       create library.properties
       create src/uberlib2.cpp
       create src/uberlib2.h
       create examples/doit/doit_example.cpp
    """
    And the exit status should be 0
    And the file "library.properties" should exist
    And the file "src/uberlib2.cpp" should exist
    And the file "src/uberlib2.h" should exist

  Scenario: as a user, I can scaffold a new library by providing all the information via prompts
    When I run particle "library init" interactively
    And I respond to the prompt "name" with "interactive"
    And I respond to the prompt "version" with "1.2.3"
    And I respond to the prompt "author" with "mrbig"
    Then the file "library.properties" should exist
    And the file "src/interactive.cpp" should exist
    And the file "src/interactive.h" should exist
    And the exit status should be 0

  Scenario: as a user, I can enter an invalid name and be given advice on how to fix it
    When I run particle "library init" interactively
    And I respond to the prompt "name" with "//"
    And I close the stdin stream
    Then the output should contain:
    """
    >> name: must only contain letters, numbers, dashes and underscores
    """

  Scenario: as a user, I can enter an empty name and be given advice on how to fix it
    When I run particle "library init" interactively
    And I respond to the prompt "name" with ""
    And I close the stdin stream
    Then the output should contain:
    """
    >> name: can't be blank
    """

  Scenario: as a user, I can enter an invalid name and be given advice on how to fix it
    When I run particle "library init" interactively
    And I respond to the prompt "name" with "//"
    And I close the stdin stream
    Then the output should contain:
    """
    >> name: must only contain letters, numbers, dashes and underscores
    """

  Scenario: as a user, I can provide an invalid name and be given immediate advice on how to fix it
    When I run particle "library init --name=//"
    Then the output should contain:
    """
    name: must only contain letters, numbers, dashes and underscores
    """

  Scenario: as a user, I can provide an invalid version and be given immediate advice on how to fix it
    When I run particle "library init --version=123"
    Then the output should contain:
    """
    version: must be formatted like 1.0.0
    """
