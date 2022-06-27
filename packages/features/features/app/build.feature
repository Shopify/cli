Feature: Building an app and/or extensions

Scenario: I build an app with extensions
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  And I create an extension named MyUiExtension of type checkout_post_purchase and flavor react
  And I create an extension named MyThemeExtension of type theme
  And I create an extension named MyFunctionExtension of type payment_methods and flavor wasm
  Then I can build the app
