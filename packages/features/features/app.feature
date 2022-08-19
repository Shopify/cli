Feature: Extension creation

Background:
  Given I have a working directory
  And I create an app named MyExtendedApp with pnpm as dependency manager

Scenario: I scaffold theme, ui, and function extensions

  When I create an extension named TestPurchaseExtensionReact of type post_purchase_ui and flavor react
  Then I have a ui extension named TestPurchaseExtensionReact of type checkout_post_purchase and flavor react
  When I create an extension named TestThemeExtension of type theme_app_extension
  Then I have a theme extension named TestThemeExtension of type theme
  Then The extension named TestThemeExtension contains the theme extension directories
  Then I create an extension named TestThemeExtension2 of type theme
  Then I do not have a theme extension named TestThemeExtension2 of type theme
  When I create an extension named TestOrderDiscounts of type order_discounts and flavor wasm
  Then I have a function extension named TestOrderDiscounts of type order_discounts
  Then I can build the app

Scenario: I scaffold ui extensions with different templates
  When I create an extension named TestPurchaseExtensionJavaScript of type checkout_ui and flavor vanilla-js
  Then I have a ui extension named TestPurchaseExtensionJavaScript of type checkout_ui_extension and flavor vanilla-js
  When I create an extension named TestPurchaseExtensionReact of type checkout_ui and flavor react
  Then I have a ui extension named TestPurchaseExtensionReact of type checkout_ui_extension and flavor react
  When I create an extension named TestPurchaseExtensionTypeScript of type checkout_ui and flavor typescript
  Then I have a ui extension named TestPurchaseExtensionTypeScript of type checkout_ui_extension and flavor typescript
  When I create an extension named TestPurchaseExtensionTypeScriptReact of type checkout_ui and flavor typescript-react
  Then I have a ui extension named TestPurchaseExtensionTypeScriptReact of type checkout_ui_extension and flavor typescript-react
