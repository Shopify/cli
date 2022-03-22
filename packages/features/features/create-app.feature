Feature: App creation

Scenario: I create a new app with Yarn
  Given I have a working directory
  When I create an app named MyApp with yarn as dependency manager and https://github.com/shopify/bfs-app-template-test as the template
  Then I have an app named MyApp scaffolded from the template with yarn as dependency manager
