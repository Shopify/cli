import React from 'react';
import {useExtensionApi, render, Text} from {{ if .UsesNext }}'@shopify/app/ui-extensions/checkout/react'{{ else }}'@shopify/checkout-ui-extensions-react'{{ end }};

render('Checkout::Dynamic::Render', () => <App />);

function App() {
  const {extensionPoint, i18n} = useExtensionApi();
  return <Text>{i18n.translate('welcome', {extensionPoint})}</Text>;
}
