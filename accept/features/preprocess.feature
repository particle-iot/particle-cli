Feature: Preprocess Wiring file

  Scenario: as a user, I can preprocess a Wiring file
    Given I use the fixture named "preprocess"
    And a directory named "output"
    When I run particle "preprocess input/app.ino --name app.ino --saveTo output/app.cpp"
    And the directories "output" and "expected" should be equal
