import { render, Text } from "@shopify/checkout-ui-extensions-react";

render("Checkout::Feature::Render", ({ extensionPoint }) => (
  <App extensionPoint={extensionPoint} />
));

function App({ extensionPoint }) {
  return <Text>Welcome to the {extensionPoint} extension!</Text>;
}
