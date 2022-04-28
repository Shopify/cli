Feature: Extension creation

@skip_node_14
Scenario: I scaffold a checkout_post_purchase extension
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  When I create a extension named MyExtension of type checkout_post_purchase
  Then I have a extension named MyExtension of type checkout_post_purchase

@skip_node_14
Scenario: I scaffold a theme extension
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  When I create a extension named MyExtension of type theme
  Then I have a extension named MyExtension of type theme
  Then The extension named MyExtension contains the theme extension directories
