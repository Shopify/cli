import React from 'react';
import {render, Text} from '@shopify/checkout-ui-extensions-react';

render('Checkout::Feature::Render', App);

function App({extensionPoint}) {
  return <Text>Welcome to the {extensionPoint} extension!</Text>;
}
