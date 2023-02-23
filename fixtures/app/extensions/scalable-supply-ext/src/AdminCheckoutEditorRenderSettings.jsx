import React, {useEffect} from 'react';

import {
  extend,
  render,
  Text,
  useExtensionApi,
} from '@shopify/admin-ui-extensions-react'

extend('Admin::CheckoutEditor::RenderSettings', render(() => <App />));

function App() {
  const api = useExtensionApi();

  debugger

  useEffect(() => {
    fetch('https://dog.ceo/api/breeds/image/random').then(console.log).catch(console.error);
  }, [])

  return (
    <Text>
      {`Welcome to the ${api.extensionPoint} extension!!!`}
    </Text>
  );
}
