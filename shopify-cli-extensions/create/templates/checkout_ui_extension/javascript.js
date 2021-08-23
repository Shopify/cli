import { extend, Text } from "@shopify/checkout-ui-extensions";

extend("Checkout::Feature::Render", (root, { extensionPoint }) => {
  root.createComponent(Text, {}, `Welcome to the ${extensionPoint} extension!`);
});
