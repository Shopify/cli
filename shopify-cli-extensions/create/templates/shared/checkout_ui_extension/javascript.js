import { extend, Text } from {{ if .UsesNext }}"@shopify/app/ui-extensions/checkout"{{ else }}"@shopify/checkout-ui-extensions"{{ end }};

extend("Checkout::Dynamic::Render", (root, { extensionPoint, i18n }) => {
  root.appendChild(
    root.createComponent(
      Text,
      {},
      i18n.translate('welcome', {extensionPoint})
    )
  );
  root.mount();
});
