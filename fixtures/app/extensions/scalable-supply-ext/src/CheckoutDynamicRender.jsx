import React from 'react';
import {
  useExtensionApi,
  render,
  Banner,
  useTranslate,
} from '@shopify/checkout-ui-extensions-react';

render('Checkout::Dynamic::Render', () => <App />);

function App() {
  const {extensionPoint} = useExtensionApi();
  const translate = useTranslate();
  return (
    <Banner title="scalable-supply-ext">
      {translate('welcome', {extensionPoint})}
    </Banner>
  );
}