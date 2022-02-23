Feature: Extension creation

Scenario: I create a new extension
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  When I create an extension named MyExtension of type checkout-post-purchase
  # Then I can load the extension MyExtension of type checkout-post-purchase (should be implemented once we have a command to get app info)
