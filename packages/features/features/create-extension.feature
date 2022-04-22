Feature: Extension creation

@skip_node_14
Scenario: I create a new extension
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  When I create a extension named MyExtension of type checkout_post_purchase
  Then I have a extension named MyExtension of type checkout_post_purchase
