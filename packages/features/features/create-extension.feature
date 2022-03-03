Feature: Extension creation

Scenario: I create a new extension
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  When I create a UI extension named MyExtension of type checkout-post-purchase
  Then I have a UI extension named MyExtension of type checkout-post-purchase
