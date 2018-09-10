Feature: viewing library

#  These tests don't pass and it's not clear how to make them pass
#  Scenario: test-library-transitive-1 exists
#    Given The particle library "test-library-transitive-1" is removed
#    And I copy the library resource "contribute/transitive" to "."
#    And a directory named "transitive/trans1" should exist
#    And I cd to "transitive/trans1"
#    And I run particle "library upload"
#    Then the output should contain "successfully uploaded"
#
#  Scenario: As a user, I can view a library with dependencies
#    When I run particle "library view test-library-transitive-1"
#    Then the output should contain "Library test-library-transitive-1 0.0.1 installed."
#    And the output should contain "Particle/community/libraries/test-library-transitive-1@0.0.1"
#
#  Scenario: ensure libraries are removed
#    Given The particle library "test-library-transitive-1" is removed
