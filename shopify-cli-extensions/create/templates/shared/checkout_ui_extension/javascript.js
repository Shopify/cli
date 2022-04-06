import { extend, Text } from "@shopify/checkout-ui-extensions";

extend("Checkout::Feature::Render", (root, { extensionPoint, i18n }) => {
  root.appendChild(
    root.createComponent(
      Text,
      {},
      i18n.translate('welcome', {extensionPoint})
    )
  );
  root.mount();
});
