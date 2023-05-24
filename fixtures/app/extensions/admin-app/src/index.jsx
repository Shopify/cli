import React from 'react';

import {
  extend,
  render,
  Text,
  useExtensionApi,
} from '@shopify/admin-ui-extensions-react'

extend('Admin::Apps::Home', render(() => <App />));
extend('Playground', render(() => <App />));

function App() {
  const {extensionPoint} = useExtensionApi();
  return (
    <Text>
      <h1>hi</h1>
    {`Welcome to the ${extensionPoint} Nick`}
    </Text>

  );
}
