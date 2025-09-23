# on windows linking to a local package causes errors in the CI environment
@skip_windows
Feature: Apps

Background:
  Given I have a working directory

Scenario: I scaffold ui, theme and function extensions in a remix app
  And I create a remix app named MyExtendedApp with npm as package manager
#  When I create an extension named TestPurchaseExtensionReact of type post_purchase_ui and flavor react
#  Then I have an extension named TestPurchaseExtensionReact of type checkout_post_purchase and flavor react
#  When I create an extension named TestThemeExtension of type theme_app_extension
#  Then I have an extension named TestThemeExtension of type theme
#  When I create an extension named TestOrderDiscounts of type order_discounts and flavor vanilla-js
#  Then I have an extension named TestOrderDiscounts of type function
  Then I build the app
#  Then all the extensions are built

Scenario: I scaffold ui and function extensions in a extension only app
  And I create a extension-only app named MyExtendedApp with npm as package manager
#  When I create an extension named TestPurchaseExtensionReact of type post_purchase_ui and flavor react
#  Then I have an extension named TestPurchaseExtensionReact of type checkout_post_purchase and flavor react
#  When I create an extension named TestOrderDiscounts of type order_discounts and flavor vanilla-js
#  Then I have an extension named TestOrderDiscounts of type function
  Then I build the app
#  Then all the extensions are built
