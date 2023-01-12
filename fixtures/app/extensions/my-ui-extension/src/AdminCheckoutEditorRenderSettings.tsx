import React from 'react';

import {
  extend,
  render,
  Text,
  useExtensionApi,
} from '@shopify/admin-ui-extensions-react'

extend('Playground', render(() => <App />));

function App() {
  const {extensionPoint} = useExtensionApi();
  return (
    <Text>
      {`Welcome to the ${extensionPoint} extension`}
    </Text>
  );
}
