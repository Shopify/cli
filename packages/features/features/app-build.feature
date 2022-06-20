Feature: Building an app and/or extensions

@skip_node_14
Scenario: I build an app with extensions
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  And I create an extension named MyUiExtension of type post_purchase_ui and flavor react
  And I create an extension named MyThemeExtension of type theme_app_extension
  And I create an extension named MyFunctionExtension of type payment_customization
  Then I can build the app
