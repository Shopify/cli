import React from 'react';
import {useExtensionApi, render, Text} from '@shopify/checkout-ui-extensions-react';

render('Checkout::Dynamic::Render', () => <App />);

function App() {
  const {extensionPoint, i18n} = useExtensionApi();
  return <Text>{i18n.translate('welcome', {extensionPoint})}</Text>;
}
