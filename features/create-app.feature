Feature: App creation

Scenario: I create a new app
  Given I have a working directory
  Given I install the Shopify CLI
  When I create an app named MyApp
  Then I should be able to build the app at MyApp
