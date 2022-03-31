Feature: App creation

Scenario: I create a new app with Yarn
  Given I have a working directory
  # Since we added "git clone" as part of creating a new app,
  # we started getting the errof: Could not read username error
  #
  # When I create an app named MyApp with yarn as dependency manager
  # Then I have an app named MyApp scaffolded from the template with yarn as dependency manager
