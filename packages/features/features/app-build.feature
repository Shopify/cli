Feature: Building an app and/or extensions

@skip_node_14
Scenario: I build an app with extensions
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  And I create a extension named MyUiExtension of type checkout_post_purchase
  And I create a extension named MyThemeExtension of type theme
  And I create a extension named MyFunctionExtension of type payment_methods
  Then I can build the app
