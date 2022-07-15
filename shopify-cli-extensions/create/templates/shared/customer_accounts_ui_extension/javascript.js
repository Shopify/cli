import { extend, Banner } from "@shopify/customer-account-ui-extensions";

extend('CustomerAccount::FullPage::RenderWithin', (root) => {
  root.appendChild(
    root.createComponent(
      Banner,
      {},
      'Welcome'
    )
  );
  root.mount();
});
