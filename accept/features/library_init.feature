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
    And the file "library.properties" should exist
    And the file "src/interactive.cpp" should exist
    And the file "src/interactive.h" should exist
    And the exit status should be 0


# todo - validate input data
  # name is filesystem safe
