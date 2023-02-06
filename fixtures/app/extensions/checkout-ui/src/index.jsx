import React from 'react';
import {useExtensionApi, render, Banner} from '@shopify/checkout-ui-extensions-react';

render('Checkout::Dynamic::Render', () => <App />);

function App() {
  const {extensionPoint, i18n} = useExtensionApi();
  return <Banner>{i18n.translate('welcome', {extensionPoint})}</Banner>;
}
