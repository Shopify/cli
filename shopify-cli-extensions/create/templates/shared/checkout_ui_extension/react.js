import React from 'react';
import {render, Text} from '@shopify/checkout-ui-extensions-react';

render('Checkout::Feature::Render', App);

function App({extensionPoint, i18n}) {
  return <Text>{i18n.translate('welcome', {extensionPoint})}</Text>;
}
