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
      `It works the ${extensionPoint} extension! APP_URL is: ${process.env.APP_URL}`
    )
  );
  root.mount();
}
