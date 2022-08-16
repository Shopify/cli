import { Text, extend } from "@shopify/admin-ui-extensions";

// Your extension must render all four modes
extend("Admin::Product::SubscriptionPlan::Add", App);
extend("Admin::Product::SubscriptionPlan::Create", App);
extend("Admin::Product::SubscriptionPlan::Remove", App);
extend("Admin::Product::SubscriptionPlan::Edit", App);

function App(root, { extensionPoint }) {
  root.appendChild(
    root.createComponent(
      Text,
      {},
      `Welcome to the ${extensionPoint} extension!`
    )
  );
  root.mount();
}
