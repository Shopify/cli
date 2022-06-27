Feature: Extension creation

Scenario: I scaffold theme, ui, and function extensions
  Given I have a working directory
  And I create an app named MyExtendedApp with yarn as dependency manager
  When I create an extension named TestPurchaseExtension of type checkout_post_purchase and flavor react
  Then I have a ui extension named TestPurchaseExtension of type checkout_post_purchase
  When I create an extension named TestThemeExtension of type theme
  Then I have a theme extension named TestThemeExtension of type theme
  Then The extension named TestThemeExtension contains the theme extension directories
  Then I create an extension named TestThemeExtension2 of type theme
  Then I do not have a theme extension named TestThemeExtension2 of type theme
  When I create an extension named TestPaymentMethod of type payment_methods and flavor wasm
  Then I have a function extension named TestPaymentMethod of type payment_methods
  Then I can build the app
